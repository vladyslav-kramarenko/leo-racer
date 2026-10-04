import * as THREE from 'three';
import { CONFIG } from '../game/config';
import { avoidanceTarget, overlapsBus } from '../world/laneAvoidance';
import type { TrafficKind, TrafficPreset } from '../world/presets/types';
import type { RoadGenerator } from '../world/RoadGenerator';
import { buildTrafficGeometries, HALF_WIDTH, SPEED_FACTOR, type TrafficVehicle } from './TrafficVehicle';

export type TrafficDensity = keyof typeof CONFIG.traffic.density;
export const TRAFFIC_DENSITIES: readonly TrafficDensity[] = ['off', 'low', 'normal', 'busy'];

export interface BusState {
  s: number;
  d: number;
}

/**
 * Built-in traffic so the world feels alive without any drawings.
 * Vehicles follow predefined road-coordinate movement in their lane
 * (same direction ahead of the bus, or oncoming) and make way for the bus.
 * No collisions, no route planning. A fixed pool — nothing is allocated while driving.
 */
export class TrafficManager {
  readonly group = new THREE.Group();
  private readonly pool: TrafficVehicle[] = [];
  private readonly geometries: Map<TrafficKind, THREE.BufferGeometry[]>;
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private density: TrafficDensity;
  private nextSpawnIn = 2;

  constructor(
    private readonly road: RoadGenerator,
    private readonly preset: TrafficPreset,
    density: TrafficDensity = 'normal',
    private readonly rng: () => number = Math.random,
  ) {
    this.density = preset.enabled ? density : 'off';
    this.geometries = buildTrafficGeometries(preset.enabled ? preset.vehicles : []);
    for (let i = 0; i < CONFIG.traffic.maxVehicles; i++) {
      const mesh = new THREE.Mesh(undefined, this.material);
      mesh.visible = false;
      mesh.matrixAutoUpdate = true;
      this.group.add(mesh);
      this.pool.push({ mesh, active: false, kind: 'car', s: 0, d: 0, laneD: 0, speed: 0, halfWidth: 1, age: 0 });
    }
  }

  setDensity(density: TrafficDensity): void {
    this.density = this.preset.enabled ? density : 'off';
    // Thin out immediately when lowering density.
    const max = CONFIG.traffic.density[this.density].max;
    let active = 0;
    for (const v of this.pool) {
      if (!v.active) continue;
      if (++active > max) this.release(v);
    }
  }

  getDensity(): TrafficDensity {
    return this.density;
  }

  activeCount(): number {
    return this.pool.reduce((n, v) => n + (v.active ? 1 : 0), 0);
  }

  update(dt: number, timeSec: number, bus: BusState): void {
    const density = CONFIG.traffic.density[this.density];
    this.nextSpawnIn -= dt;
    if (this.nextSpawnIn <= 0) {
      if (this.activeCount() < density.max) this.spawn(bus);
      const [min, max] = density.intervalSec;
      this.nextSpawnIn = min + this.rng() * (max - min);
    }

    const lanes = CONFIG.lanes;
    for (const v of this.pool) {
      if (!v.active) continue;
      v.age += dt;
      v.s += v.speed * dt;
      const target = avoidanceTarget(
        { s: v.s, laneD: v.laneD, d: v.d, busS: bus.s, busD: bus.d, clearance: 1.35 + v.halfWidth },
        lanes,
      );
      const step = lanes.dodgeSpeed * dt;
      const vd = Math.abs(target - v.d) <= step ? 0 : Math.sign(target - v.d) * lanes.dodgeSpeed;
      v.d = Math.abs(target - v.d) <= step ? target : v.d + Math.sign(target - v.d) * step;

      const ds = v.s - bus.s;
      if (ds < -30 || ds > 280 || v.age > 120 || overlapsBus(v.s, v.d, bus.s, bus.d, v.halfWidth)) {
        this.release(v);
        continue;
      }
      this.pose(v, vd, timeSec);
    }
  }

  private spawn(bus: BusState): void {
    const v = this.pool.find((p) => !p.active);
    if (!v || !this.preset.vehicles.length) return;
    const kind = this.preset.vehicles[Math.floor(this.rng() * this.preset.vehicles.length)];
    const variants = this.geometries.get(kind);
    if (!variants?.length) return;

    const cruise = CONFIG.driving.speed * (SPEED_FACTOR[kind] ?? 1);
    const oncoming = this.rng() < 0.6;
    const laneD = oncoming ? -CONFIG.lanes.laneOffset : CONFIG.lanes.laneOffset;
    const s = oncoming ? bus.s + 190 + this.rng() * 30 : bus.s + 130 + this.rng() * 40;
    // Keep a gap to anything already in that lane.
    if (this.pool.some((o) => o.active && Math.sign(o.laneD) === Math.sign(laneD) && Math.abs(o.s - s) < 25)) return;

    v.active = true;
    v.kind = kind;
    v.s = s;
    v.laneD = laneD;
    v.d = laneD;
    v.speed = oncoming ? -cruise * CONFIG.traffic.oppositeDirectionSpeed : cruise * CONFIG.traffic.sameDirectionSpeed;
    v.halfWidth = HALF_WIDTH[kind];
    v.age = 0;
    v.mesh.geometry = variants[Math.floor(this.rng() * variants.length)];
    v.mesh.visible = true;
  }

  private release(v: TrafficVehicle): void {
    v.active = false;
    v.mesh.visible = false;
  }

  private pose(v: TrafficVehicle, vd: number, timeSec: number): void {
    const f = this.road.frame(v.s);
    v.mesh.position.set(f.x + f.rx * v.d, Math.abs(Math.sin(timeSec * 7 + v.s)) * 0.02, f.z + f.rz * v.d);
    // Face the direction of travel (including sideways motion while making way).
    const dx = f.fx * v.speed + f.rx * vd;
    const dz = f.fz * v.speed + f.rz * vd;
    v.mesh.rotation.y = Math.atan2(-dx, -dz);
  }
}
