import * as THREE from 'three';
import { CONFIG } from '../game/config';
import { buildPropGeometry } from './props';
import type { PropKind, PropSpec, PropsPreset } from './presets/types';
import { createRng, hashInt, randRange } from './random';
import type { RoadGenerator } from './RoadGenerator';

interface PropPool {
  kind: PropKind;
  mesh: THREE.InstancedMesh;
  perSlot: number;
}

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Roadside props. One InstancedMesh per prop kind (one draw call each);
 * every road-chunk slot owns a fixed range of instances that is rewritten on recycle.
 */
export class ObjectSpawner {
  readonly group = new THREE.Group();
  private readonly pools = new Map<PropKind, PropPool>();
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private readonly totalWeight: number;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly sc = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(
    private readonly road: RoadGenerator,
    private readonly preset: PropsPreset,
    slots: number,
  ) {
    const kinds = new Map<PropKind, number>();
    for (const item of preset.items) kinds.set(item.kind, Math.max(kinds.get(item.kind) ?? 0, item.maxPerChunk));
    if (preset.shoulderCones > 0) kinds.set('cone', Math.max(kinds.get('cone') ?? 0, preset.shoulderCones));

    for (const [kind, perSlot] of kinds) {
      const mesh = new THREE.InstancedMesh(buildPropGeometry(kind), this.material, perSlot * slots);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // Instances span the whole visible road; per-frame culling of the pool is not worth it.
      mesh.frustumCulled = false;
      for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, ZERO);
      this.pools.set(kind, { kind, mesh, perSlot });
      this.group.add(mesh);
    }
    this.totalWeight = preset.items.reduce((sum, p) => sum + p.weight, 0);
  }

  get drawCalls(): number {
    return this.pools.size;
  }

  /** Regenerate props for a chunk slot. Deterministic per chunk index. */
  populate(slot: number, chunkIndex: number): void {
    const rng = createRng(hashInt(chunkIndex, 7));
    const used = new Map<PropKind, number>();
    const L = CONFIG.world.chunkLength;
    const s0 = chunkIndex * L;
    const edge = CONFIG.road.halfWidth + CONFIG.road.shoulderWidth;

    // Clear this slot.
    for (const pool of this.pools.values()) {
      for (let i = 0; i < pool.perSlot; i++) pool.mesh.setMatrixAt(slot * pool.perSlot + i, ZERO);
    }

    // Shoulder cones in a tidy row, alternating sides every other chunk.
    const coneSide = chunkIndex % 2 === 0 ? 1 : -1;
    for (let i = 0; i < this.preset.shoulderCones; i++) {
      const s = s0 + ((i + 0.5) / this.preset.shoulderCones) * L;
      this.place(slot, used, 'cone', s, coneSide * (CONFIG.road.halfWidth + 0.9), 1, rng() * Math.PI);
    }

    const count = Math.floor(randRange(rng, this.preset.perChunk[0], this.preset.perChunk[1] + 1));
    for (let n = 0; n < count; n++) {
      const spec = this.pick(rng);
      if ((used.get(spec.kind) ?? 0) >= spec.maxPerChunk) continue;
      const side = rng() < 0.5 ? -1 : 1;
      const s = s0 + rng() * L;
      const d = side * (edge + randRange(rng, spec.minDistance, spec.maxDistance));
      const scale = randRange(rng, spec.scale[0], spec.scale[1]);
      this.place(slot, used, spec.kind, s, d, scale, this.yawFor(spec, s, side, rng));
    }

    for (const pool of this.pools.values()) pool.mesh.instanceMatrix.needsUpdate = true;
  }

  private pick(rng: () => number): PropSpec {
    let r = rng() * this.totalWeight;
    for (const item of this.preset.items) {
      r -= item.weight;
      if (r <= 0) return item;
    }
    return this.preset.items[this.preset.items.length - 1];
  }

  private yawFor(spec: PropSpec, s: number, side: number, rng: () => number): number {
    const f = this.road.frame(s);
    switch (spec.facing) {
      case 'road':
        // Model front (-Z) points across the road.
        return Math.atan2(side * f.rx, side * f.rz);
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
  ): void {
    const pool = this.pools.get(kind);
    if (!pool) return;
    const n = used.get(kind) ?? 0;
    if (n >= pool.perSlot) return;
    used.set(kind, n + 1);
    const p = this.road.point(s, d);
    this.q.setFromAxisAngle(this.up, yaw);
    this.v.set(p.x, 0, p.z);
    this.sc.setScalar(scale);
    this.m.compose(this.v, this.q, this.sc);
    pool.mesh.setMatrixAt(slot * pool.perSlot + n, this.m);
  }
}
