import * as THREE from 'three';
import { CONFIG } from '../game/config';
import { buildPropModel, type PartAnim, type PropModel } from './props';
import type { PropKind, PropSpec, PropsPreset } from './presets/types';
import { createRng, hashInt, randRange } from './random';
import type { RoadGenerator } from './RoadGenerator';

interface PartPool {
  mesh: THREE.InstancedMesh;
  pivot: THREE.Vector3;
  anim: PartAnim;
}

interface PropPool {
  kind: PropKind;
  mesh: THREE.InstancedMesh;
  perSlot: number;
  parts: PartPool[];
  tints: THREE.Color[] | null;
  /** Placed instance matrices (needed to drive animated parts). */
  base: THREE.Matrix4[];
  active: boolean[];
  cutout?: { offset: number; footprint: NonNullable<PropModel['groundCutout']> };
  exclusion?: { offset: number; size: [number, number] };
}

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const EDGE = CONFIG.road.halfWidth + CONFIG.road.shoulderWidth;

/**
 * Roadside props. One InstancedMesh per prop kind (one draw call each), plus one per
 * animated part. Every road-chunk slot owns a fixed range of instances that is rewritten
 * on recycle — nothing is allocated while driving.
 */
export class ObjectSpawner {
  readonly group = new THREE.Group();
  readonly groundCutouts: THREE.Vector4[] = [];
  readonly groundCutoutRotations: THREE.Vector2[] = [];
  private readonly exclusionAreas: { bounds: THREE.Vector4; rotation: THREE.Vector2 }[] = [];
  private readonly pools = new Map<PropKind, PropPool>();
  private readonly lit = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private readonly unlit = new THREE.MeshBasicMaterial({ vertexColors: true });
  private readonly totalWeight: number;
  /** Randomly picked roadside items vs. landmarks placed every N chunks. */
  private readonly randomItems: PropSpec[];
  private readonly landmarks: PropSpec[];
  private readonly shoulderProp: PropKind;
  private readonly m = new THREE.Matrix4();
  private readonly m2 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly sc = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(
    private readonly road: RoadGenerator,
    private readonly preset: PropsPreset,
    slots: number,
  ) {
    this.shoulderProp = preset.shoulderProp ?? 'cone';
    const kinds = new Map<PropKind, number>();
    for (const item of preset.items) kinds.set(item.kind, Math.max(kinds.get(item.kind) ?? 0, item.maxPerChunk));
    if (preset.shoulderCones > 0) {
      kinds.set(this.shoulderProp, (kinds.get(this.shoulderProp) ?? 0) + preset.shoulderCones);
    }

    for (const [kind, perSlot] of kinds) {
      const model = buildPropModel(kind);
      const capacity = perSlot * slots;
      const cutout = model.groundCutout ? { offset: this.groundCutouts.length, footprint: model.groundCutout } : undefined;
      const exclusion = model.placementExclusion ? { offset: this.exclusionAreas.length, size: model.placementExclusion } : undefined;
      if (exclusion) {
        for (let i = 0; i < capacity; i++) this.exclusionAreas.push({ bounds: new THREE.Vector4(), rotation: new THREE.Vector2(1, 0) });
      }
      if (cutout) {
        for (let i = 0; i < capacity; i++) {
          this.groundCutouts.push(new THREE.Vector4());
          this.groundCutoutRotations.push(new THREE.Vector2(1, 0));
        }
      }
      const mesh = this.instanced(model.body, this.lit, capacity);
      const parts = (model.parts ?? []).map((p) => ({
        mesh: this.instanced(p.geometry, p.unlit ? this.unlit : this.lit, capacity),
        pivot: new THREE.Vector3(...p.pivot),
        anim: p.anim,
      }));
      const tints = model.tints?.map((c) => new THREE.Color(c)) ?? null;
      if (tints) for (let i = 0; i < capacity; i++) mesh.setColorAt(i, tints[0]);
      this.pools.set(kind, {
        kind,
        mesh,
        perSlot,
        parts,
        tints,
        base: Array.from({ length: capacity }, () => new THREE.Matrix4()),
        active: new Array(capacity).fill(false),
        cutout,
        exclusion,
      });
    }
    this.randomItems = preset.items.filter((i) => !i.every);
    this.landmarks = preset.items.filter((i) => i.every);
    this.totalWeight = this.randomItems.reduce((sum, p) => sum + p.weight, 0);
  }

  get drawCalls(): number {
    let n = 0;
    for (const pool of this.pools.values()) n += 1 + pool.parts.length;
    return n;
  }

  /** Regenerate props for a chunk slot. Deterministic per chunk index. */
  populate(slot: number, chunkIndex: number): void {
    const rng = createRng(hashInt(chunkIndex, 7));
    const used = new Map<PropKind, number>();
    const L = CONFIG.world.chunkLength;
    const s0 = chunkIndex * L;

    for (const pool of this.pools.values()) {
      for (let i = 0; i < pool.perSlot; i++) {
        const idx = slot * pool.perSlot + i;
        pool.mesh.setMatrixAt(idx, ZERO);
        pool.active[idx] = false;
        if (pool.cutout) this.groundCutouts[pool.cutout.offset + idx].set(0, 0, 0, 0);
        if (pool.exclusion) this.exclusionAreas[pool.exclusion.offset + idx].bounds.set(0, 0, 0, 0);
        for (const part of pool.parts) part.mesh.setMatrixAt(idx, ZERO);
      }
    }

    // A tidy row along the shoulder (cones, fences, street lamps), alternating sides per chunk.
    const rowSide = chunkIndex % 2 === 0 ? 1 : -1;
    const rowDistance = this.preset.shoulderDistance ?? -1.6;
    for (let i = 0; i < this.preset.shoulderCones; i++) {
      const s = s0 + ((i + 0.5) / this.preset.shoulderCones) * L;
      const yaw = this.shoulderProp === 'cone' ? rng() * Math.PI : this.yawFor('road', s, rowSide, rng);
      this.place(slot, used, this.shoulderProp, s, rowSide * (EDGE + rowDistance), 1, yaw, rng);
    }

    // Landmarks: exactly one in every N-th chunk, in the middle of it.
    for (const spec of this.landmarks) {
      const { chunks, offset = 0 } = spec.every!;
      if ((((chunkIndex - offset) % chunks) + chunks) % chunks !== 0) continue;
      const side = pickSide(spec, rng);
      const s = s0 + L * (0.4 + rng() * 0.2);
      const d = spec.roadCentered ? 0 : side * (EDGE + randRange(rng, spec.minDistance, spec.maxDistance));
      this.place(slot, used, spec.kind, s, d, randRange(rng, spec.scale[0], spec.scale[1]), this.yawFor(spec.facing, s, side, rng), rng);
    }

    const count = this.randomItems.length ? Math.floor(randRange(rng, this.preset.perChunk[0], this.preset.perChunk[1] + 1)) : 0;
    for (let n = 0; n < count; n++) {
      const spec = this.pick(rng);
      const side = pickSide(spec, rng);
      const s = s0 + rng() * L;
      const d = side * (EDGE + randRange(rng, spec.minDistance, spec.maxDistance));
      const scale = randRange(rng, spec.scale[0], spec.scale[1]);
      const point = this.road.point(s, d);
      if (this.exclusionAreas.some(({ bounds, rotation }) => {
        const dx = point.x - bounds.x;
        const dz = point.z - bounds.y;
        return bounds.z > 0 && Math.abs(dx * rotation.x - dz * rotation.y) < bounds.z
          && Math.abs(dx * rotation.y + dz * rotation.x) < bounds.w;
      })) continue;
      // Keep random machinery and supplies out of the open excavation and its work area.
      if (this.groundCutouts.some((hole, index) => {
        if (hole.z === 0) return false;
        const rotation = this.groundCutoutRotations[index];
        const dx = point.x - hole.x;
        const dz = point.z - hole.y;
        return Math.abs(dx * rotation.x - dz * rotation.y) < hole.z + 7
          && Math.abs(dx * rotation.y + dz * rotation.x) < hole.w + 5;
      })) continue;
      this.place(slot, used, spec.kind, s, d, scale, this.yawFor(spec.facing, s, side, rng), rng);
    }

    for (const pool of this.pools.values()) {
      pool.mesh.instanceMatrix.needsUpdate = true;
      if (pool.mesh.instanceColor) pool.mesh.instanceColor.needsUpdate = true;
      for (const part of pool.parts) part.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Drive animated parts (crane jibs, windmill blades, beacons…). Cheap: only placed instances. */
  animate(timeSec: number): void {
    for (const pool of this.pools.values()) {
      if (!pool.parts.length) continue;
      for (let idx = 0; idx < pool.active.length; idx++) {
        if (!pool.active[idx]) continue;
        const phase = (idx * 1.618) % 6.283;
        for (const part of pool.parts) {
          this.partMatrix(part, pool.base[idx], timeSec, phase);
          part.mesh.setMatrixAt(idx, this.m);
        }
      }
      for (const part of pool.parts) part.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private partMatrix(part: PartPool, base: THREE.Matrix4, t: number, phase: number): void {
    const a = part.anim;
    let angle = 0;
    let visible = true;
    switch (a.type) {
      case 'spin':
        angle = a.speed * t + phase;
        break;
      case 'swing':
        angle = (a.bias ?? 0) + a.amplitude * Math.sin(a.speed * t + phase);
        break;
      case 'blink':
        visible = ((t * a.hz + phase / 6.283) % 1) < a.duty;
        break;
      case 'cycle': {
        const f = ((t + phase) / a.period) % 1;
        visible = f >= a.from && f < a.to;
        break;
      }
      case 'shuttle': {
        // Smooth back-and-forth (ease in/out at both ends).
        const k = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / a.period + phase);
        this.m2.makeTranslation(
          part.pivot.x + a.vector[0] * k,
          part.pivot.y + a.vector[1] * k,
          part.pivot.z + a.vector[2] * k,
        );
        this.m.multiplyMatrices(base, this.m2);
        return;
      }
      case 'maneuver': {
        const turn = a.angle * Math.sin((2 * Math.PI * t) / a.period + phase);
        this.m2.makeRotationY(-turn);
        this.m2.setPosition(
          part.pivot.x + a.radius * (1 - Math.cos(turn)),
          part.pivot.y,
          part.pivot.z - a.radius * Math.sin(turn),
        );
        this.m.multiplyMatrices(base, this.m2);
        return;
      }
      case 'crossing': {
        const cycle = (2 * Math.PI * t) / a.period + phase;
        const k = 0.5 - 0.5 * Math.cos(cycle);
        // Turn gradually while slowing at the ends instead of flipping instantly.
        this.m2.makeRotationY(-Math.PI / 2 * Math.tanh(Math.sin(cycle) * 6));
        this.m2.setPosition(part.pivot.x + a.span * k, part.pivot.y, part.pivot.z);
        this.m.multiplyMatrices(base, this.m2);
        return;
      }
      case 'slide': {
        const f = (t / a.period + phase / 6.283) % 1;
        this.m2.makeTranslation(
          part.pivot.x + a.vector[0] * f,
          part.pivot.y + a.vector[1] * f,
          part.pivot.z + a.vector[2] * f,
        );
        this.m.multiplyMatrices(base, this.m2);
        return;
      }
    }
    if (!visible) {
      this.m.copy(ZERO);
      return;
    }
    if (a.type === 'spin' || a.type === 'swing') {
      if (a.axis === 'x') this.m2.makeRotationX(angle);
      else if (a.axis === 'y') this.m2.makeRotationY(angle);
      else this.m2.makeRotationZ(angle);
    } else {
      this.m2.identity();
    }
    this.m2.setPosition(part.pivot);
    this.m.multiplyMatrices(base, this.m2);
  }

  private instanced(geometry: THREE.BufferGeometry, material: THREE.Material, capacity: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Instances span the whole visible road; per-frame culling of the pool is not worth it.
    mesh.frustumCulled = false;
    for (let i = 0; i < capacity; i++) mesh.setMatrixAt(i, ZERO);
    this.group.add(mesh);
    return mesh;
  }

  private pick(rng: () => number): PropSpec {
    let r = rng() * this.totalWeight;
    for (const item of this.randomItems) {
      r -= item.weight;
      if (r <= 0) return item;
    }
    return this.randomItems[this.randomItems.length - 1];
  }

  private yawFor(facing: PropSpec['facing'], s: number, side: number, rng: () => number): number {
    const f = this.road.frame(s);
    switch (facing) {
      case 'road':
        // Model front (-Z) points across the road.
        return Math.atan2(side * f.rx, side * f.rz);
      case 'away':
        return Math.atan2(-side * f.rx, -side * f.rz);
      case 'traffic':
        // Front faces the approaching bus (opposite to road forward).
        return Math.atan2(f.fx, f.fz);
      default:
        return rng() * Math.PI * 2;
    }
  }

  private place(
    slot: number,
    used: Map<PropKind, number>,
    kind: PropKind,
    s: number,
    d: number,
    scale: number,
    yaw: number,
    rng: () => number,
  ): void {
    const pool = this.pools.get(kind);
    if (!pool) return;
    const n = used.get(kind) ?? 0;
    if (n >= pool.perSlot) return;
    used.set(kind, n + 1);
    const idx = slot * pool.perSlot + n;
    const p = this.road.point(s, d);
    this.q.setFromAxisAngle(this.up, yaw);
    this.v.set(p.x, 0, p.z);
    this.sc.setScalar(scale);
    pool.base[idx].compose(this.v, this.q, this.sc);
    pool.mesh.setMatrixAt(idx, pool.base[idx]);
    pool.active[idx] = true;
    if (pool.exclusion) {
      const area = this.exclusionAreas[pool.exclusion.offset + idx];
      area.bounds.set(p.x, p.z, pool.exclusion.size[0] * scale / 2, pool.exclusion.size[1] * scale / 2);
      area.rotation.set(Math.cos(yaw), Math.sin(yaw));
    }
    if (pool.cutout) {
      const { center, size } = pool.cutout.footprint;
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      const hole = pool.cutout.offset + idx;
      this.groundCutouts[hole].set(p.x + scale * (cos * center[0] + sin * center[1]),
        p.z + scale * (-sin * center[0] + cos * center[1]), size[0] * scale / 2, size[1] * scale / 2);
      this.groundCutoutRotations[hole].set(cos, sin);
    }
    if (pool.tints) pool.mesh.setColorAt(idx, pool.tints[Math.floor(rng() * pool.tints.length)]);
  }
}

function pickSide(spec: PropSpec, rng: () => number): number {
  if (spec.side === 'left') return -1;
  if (spec.side === 'right') return 1;
  return rng() < 0.5 ? -1 : 1;
}
