import * as THREE from 'three';
import { CONFIG } from '../game/config';
import { box, buildColoredGeometry, cyl, rbox } from './geometry';
import type { GuidewayPreset } from './presets/types';
import type { RoadGenerator } from './RoadGenerator';

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Elevated rail (SkyTrain-style) running alongside the road, with a train that now and then
 * overtakes the bus or comes the other way. Data-driven from the world preset.
 *
 * - The beam is one mesh: each road-chunk slot owns a vertex range rewritten on recycle.
 * - Columns and train cars are instanced; night windows add one optional draw call.
 */
export class Guideway {
  readonly group = new THREE.Group();
  private readonly beamPositions: THREE.BufferAttribute;
  private readonly beamNormals: THREE.BufferAttribute;
  private readonly beam: THREE.Mesh;
  private readonly columns: THREE.InstancedMesh;
  private readonly train: THREE.InstancedMesh;
  private readonly trainWindows: THREE.InstancedMesh | null;
  private readonly segs = CONFIG.world.segmentsPerChunk;
  private readonly length = CONFIG.world.chunkLength;
  private readonly columnsPerChunk: number;
  private readonly offset: number;
  private trainS: number | null = null;
  private trainSpeed = 0;
  private nextTrainIn: number;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly one = new THREE.Vector3(1, 1, 1);
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly p = { x: 0, z: 0 };

  constructor(
    private readonly road: RoadGenerator,
    private readonly cfg: GuidewayPreset,
    slots: number,
    private readonly rng: () => number = Math.random,
  ) {
    this.offset = (cfg.side === 'left' ? -1 : 1) * cfg.offset;
    this.columnsPerChunk = Math.max(1, Math.round(this.length / cfg.columnSpacing));
    this.nextTrainIn = 3;

    // Beam: 4 faces (bottom, outer, top, inner) × (segs+1) rows × 2 vertices, per slot.
    const vertsPerSlot = 4 * (this.segs + 1) * 2;
    const geometry = new THREE.BufferGeometry();
    this.beamPositions = new THREE.BufferAttribute(new Float32Array(slots * vertsPerSlot * 3), 3);
    this.beamNormals = new THREE.BufferAttribute(new Float32Array(slots * vertsPerSlot * 3), 3);
    this.beamPositions.setUsage(THREE.DynamicDrawUsage);
    this.beamNormals.setUsage(THREE.DynamicDrawUsage);
    const index: number[] = [];
    for (let slot = 0; slot < slots; slot++) {
      for (let face = 0; face < 4; face++) {
        const base = slot * vertsPerSlot + face * (this.segs + 1) * 2;
        for (let i = 0; i < this.segs; i++) {
          const a = base + i * 2;
          index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    }
    geometry.setAttribute('position', this.beamPositions);
    geometry.setAttribute('normal', this.beamNormals);
    geometry.setIndex(index);
    this.beam = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: cfg.color, side: THREE.DoubleSide }));
    this.beam.frustumCulled = false;

    const columnGeometry = buildColoredGeometry([
      { geometry: cyl(0.55, 0.65, cfg.height, 10), color: cfg.color, position: [0, cfg.height / 2, 0] },
      { geometry: rbox(2.2, 0.6, 1.4, 0.15), color: cfg.color, position: [0, cfg.height - 0.3, 0] },
    ]);
    this.columns = new THREE.InstancedMesh(
      columnGeometry,
      new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
      slots * this.columnsPerChunk,
    );
    this.columns.frustumCulled = false;
    for (let i = 0; i < this.columns.count; i++) this.columns.setMatrixAt(i, ZERO);

    this.train = new THREE.InstancedMesh(
      buildColoredGeometry(trainCarParts(cfg)),
      new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
      cfg.train.cars,
    );
    this.train.frustumCulled = false;
    this.trainWindows = cfg.train.windowGlow ? new THREE.InstancedMesh(
      trainWindowGeometry(cfg.train.carLength), new THREE.MeshBasicMaterial({ color: '#ffe4a3' }), cfg.train.cars,
    ) : null;
    if (this.trainWindows) {
      this.trainWindows.frustumCulled = false;
      this.group.add(this.trainWindows);
    }
    this.hideTrain();

    this.group.add(this.beam, this.columns, this.train);
  }

  /** Rebuild the beam and columns for a recycled road chunk. */
  assign(slot: number, chunkIndex: number): void {
    const s0 = chunkIndex * this.length;
    const vertsPerSlot = 4 * (this.segs + 1) * 2;
    const halfW = this.cfg.width / 2;
    const yTop = this.cfg.height + this.cfg.thickness;
    const yBottom = this.cfg.height;
    // Cross-section corners (lateral offset, height): bottom-in, bottom-out, top-out, top-in.
    const faces: [[number, number], [number, number], THREE.Vector3Tuple][] = [
      [[-halfW, yBottom], [halfW, yBottom], [0, -1, 0]],
      [[halfW, yBottom], [halfW, yTop], [1, 0, 0]],
      [[halfW, yTop], [-halfW, yTop], [0, 1, 0]],
      [[-halfW, yTop], [-halfW, yBottom], [-1, 0, 0]],
    ];
    faces.forEach(([a, b, n], face) => {
      const base = slot * vertsPerSlot + face * (this.segs + 1) * 2;
      for (let i = 0; i <= this.segs; i++) {
        const s = s0 + (i / this.segs) * this.length;
        const f = this.road.frame(s);
        // Sideways normals follow the road's right vector.
        const nx = n[0] * f.rx;
        const nz = n[0] * f.rz;
        this.road.point(s, this.offset + a[0], this.p);
        this.beamPositions.setXYZ(base + i * 2, this.p.x, a[1], this.p.z);
        this.beamNormals.setXYZ(base + i * 2, nx, n[1], nz);
        this.road.point(s, this.offset + b[0], this.p);
        this.beamPositions.setXYZ(base + i * 2 + 1, this.p.x, b[1], this.p.z);
        this.beamNormals.setXYZ(base + i * 2 + 1, nx, n[1], nz);
      }
    });
    this.beamPositions.needsUpdate = true;
    this.beamNormals.needsUpdate = true;

    for (let c = 0; c < this.columnsPerChunk; c++) {
      const s = s0 + ((c + 0.5) / this.columnsPerChunk) * this.length;
      const f = this.road.frame(s);
      this.road.point(s, this.offset, this.p);
      this.q.setFromAxisAngle(this.up, -f.heading);
      this.v.set(this.p.x, 0, this.p.z);
      this.m.compose(this.v, this.q, this.one);
      this.columns.setMatrixAt(slot * this.columnsPerChunk + c, this.m);
    }
    this.columns.instanceMatrix.needsUpdate = true;
  }

  isTrainRunning(): boolean {
    return this.trainS !== null;
  }

  update(dt: number, progress: number): void {
    const t = this.cfg.train;
    if (this.trainS === null) {
      this.nextTrainIn -= dt;
      if (this.nextTrainIn > 0) return;
      // Either overtake the bus from behind, or come the other way.
      const overtaking = this.rng() < 0.55;
      this.trainSpeed = overtaking ? t.speed : -t.speed * 0.9;
      this.trainS = overtaking ? progress - 60 : progress + 230;
    }

    this.trainS += this.trainSpeed * dt;
    const ahead = this.trainS - progress;
    if (ahead > 260 || ahead < -90) {
      this.trainS = null;
      this.hideTrain();
      const [min, max] = t.intervalSec;
      this.nextTrainIn = min + this.rng() * (max - min);
      return;
    }

    const dir = Math.sign(this.trainSpeed) || 1;
    for (let i = 0; i < t.cars; i++) {
      // Cars trail behind the lead car, in the direction of travel.
      const s = this.trainS - dir * i * (t.carLength + 0.4);
      const f = this.road.frame(s);
      this.road.point(s, this.offset, this.p);
      this.q.setFromAxisAngle(this.up, -f.heading + (dir < 0 ? Math.PI : 0));
      this.v.set(this.p.x, this.cfg.height + this.cfg.thickness, this.p.z);
      this.m.compose(this.v, this.q, this.one);
      this.train.setMatrixAt(i, this.m);
      this.trainWindows?.setMatrixAt(i, this.m);
    }
    this.train.instanceMatrix.needsUpdate = true;
    if (this.trainWindows) this.trainWindows.instanceMatrix.needsUpdate = true;
  }

  private hideTrain(): void {
    for (let i = 0; i < this.train.count; i++) {
      this.train.setMatrixAt(i, ZERO);
      this.trainWindows?.setMatrixAt(i, ZERO);
    }
    this.train.instanceMatrix.needsUpdate = true;
    if (this.trainWindows) this.trainWindows.instanceMatrix.needsUpdate = true;
  }
}

function trainWindowGeometry(length: number): THREE.BufferGeometry {
  const parts: Parameters<typeof buildColoredGeometry>[0] = [];
  for (const x of [-1.29, 1.29]) for (const z of [-length / 2 + 1, -0.65, 0.65, length / 2 - 1]) {
    parts.push({ geometry: rbox(0.04, 0.62, 0.85, 0.025), color: '#ffffff', position: [x, 2.05, z] });
  }
  for (const z of [-length / 2 - 0.07, length / 2 + 0.07]) {
    parts.push({ geometry: rbox(1.8, 0.7, 0.03, 0.015), color: '#ffffff', position: [0, 2, z] });
  }
  return buildColoredGeometry(parts);
}

/** One rounded train car facing -Z, sitting on y = 0 (the top of the beam). */
function trainCarParts(cfg: GuidewayPreset): Parameters<typeof buildColoredGeometry>[0] {
  const L = cfg.train.carLength;
  const { body, stripe, window } = cfg.train.colors;
  const parts: Parameters<typeof buildColoredGeometry>[0] = [
    { geometry: rbox(2.5, 2.7, L, 0.55, 2), color: body, position: [0, 1.55, 0] },
    { geometry: rbox(2.54, 0.9, L - 1.0, 0.1), color: window, position: [0, 2.0, 0] },
    { geometry: rbox(2.56, 0.32, L - 0.6, 0.08), color: stripe, position: [0, 1.15, 0] },
    { geometry: rbox(2.0, 0.85, 0.08, 0.06), color: window, position: [0, 2.0, -L / 2 - 0.02] },
    { geometry: rbox(2.0, 0.85, 0.08, 0.06), color: window, position: [0, 2.0, L / 2 + 0.02] },
    { geometry: rbox(2.2, 0.3, L - 0.8, 0.1), color: '#4b4e53', position: [0, 0.18, 0] },
  ];
  // Doors: two per side.
  for (const z of [-L / 4, L / 4]) {
    for (const x of [-1.27, 1.27]) parts.push({ geometry: box(0.04, 1.8, 1.1), color: stripe, position: [x, 1.45, z] });
  }
  return parts;
}
