import type * as THREE from 'three';
import { box, buildColoredGeometry, cyl, type ColoredPart } from '../world/geometry';
import { carParts, dumpTruckParts, tractorParts } from '../world/props';
import type { TrafficKind } from '../world/presets/types';

const DARK = '#2f3237';
const GLASS = '#9fd7ff';
const WHITE = '#fafafa';
export const CAR_COLORS = ['#e8453c', '#3d7be0', '#f2c230', '#46b05a', '#f2f2f2', '#9b59d0', '#ff8a3d'];

export interface TrafficVehicle {
  mesh: THREE.Mesh;
  active: boolean;
  kind: TrafficKind;
  /** Position along the road and lateral offset. */
  s: number;
  d: number;
  /** Preferred lane offset. */
  laneD: number;
  /** Signed speed along the road (negative = oncoming). */
  speed: number;
  halfWidth: number;
  age: number;
}

function wheel(x: number, z: number, r = 0.45, w = 0.35): ColoredPart {
  return { geometry: cyl(r, r, w, 10), color: DARK, position: [x, r, z], rotation: [0, 0, Math.PI / 2] };
}

function pickup(color: string): ColoredPart[] {
  return [
    { geometry: box(1.9, 0.8, 5), color, position: [0, 0.85, 0] },
    { geometry: box(1.8, 0.8, 1.8), color, position: [0, 1.65, -0.7] },
    { geometry: box(1.6, 0.55, 0.05), color: GLASS, position: [0, 1.7, -1.62] },
    { geometry: box(1.7, 0.3, 2.1), color: DARK, position: [0, 1.4, 1.3] },
    wheel(-0.9, -1.6),
    wheel(0.9, -1.6),
    wheel(-0.9, 1.6),
    wheel(0.9, 1.6),
  ];
}

function van(color: string): ColoredPart[] {
  return [
    { geometry: box(2, 2, 4.8), color, position: [0, 1.35, 0] },
    { geometry: box(1.8, 0.7, 0.05), color: GLASS, position: [0, 1.9, -2.42] },
    { geometry: box(0.05, 0.6, 1), color: GLASS, position: [-1.01, 1.9, -1.6] },
    { geometry: box(0.05, 0.6, 1), color: GLASS, position: [1.01, 1.9, -1.6] },
    { geometry: box(2.04, 0.25, 4.84), color: WHITE, position: [0, 1.0, 0] },
    wheel(-0.95, -1.6),
    wheel(0.95, -1.6),
    wheel(-0.95, 1.6),
    wheel(0.95, 1.6),
  ];
}

function mixer(): ColoredPart[] {
  const parts: ColoredPart[] = [
    { geometry: box(2.4, 0.5, 6), color: DARK, position: [0, 0.85, 0] },
    { geometry: box(2.4, 1.6, 1.6), color: '#e8e8e8', position: [0, 1.9, -2.2] },
    { geometry: box(2.1, 0.7, 0.05), color: GLASS, position: [0, 2.2, -3.02] },
    { geometry: cyl(1.05, 1.25, 3.6, 10), color: '#ff8a3d', position: [0, 2.35, 0.9], rotation: [Math.PI / 2 - 0.2, 0, 0] },
    wheel(-1.2, -2.2, 0.55, 0.45),
    wheel(1.2, -2.2, 0.55, 0.45),
    wheel(-1.2, 1.6, 0.55, 0.45),
    wheel(1.2, 1.6, 0.55, 0.45),
    wheel(-1.2, 2.6, 0.55, 0.45),
    wheel(1.2, 2.6, 0.55, 0.45),
  ];
  // White stripes on the drum.
  for (const z of [0.2, 1.4]) {
    parts.push({ geometry: cyl(1.17, 1.17, 0.25, 10), color: WHITE, position: [0, 2.35 + (z - 0.9) * 0.2, z], rotation: [Math.PI / 2 - 0.2, 0, 0] });
  }
  return parts;
}

function cityBus(): ColoredPart[] {
  const parts: ColoredPart[] = [
    { geometry: box(2.5, 2.6, 10), color: '#d8433b', position: [0, 1.75, 0] },
    { geometry: box(2.4, 0.2, 9.8), color: WHITE, position: [0, 3.15, 0] },
    { geometry: box(2.2, 1.1, 0.05), color: GLASS, position: [0, 2.2, -5.02] },
    wheel(-1.15, -3.3, 0.55, 0.4),
    wheel(1.15, -3.3, 0.55, 0.4),
    wheel(-1.15, 3.3, 0.55, 0.4),
    wheel(1.15, 3.3, 0.55, 0.4),
  ];
  for (let i = 0; i < 6; i++) {
    const z = -3.6 + i * 1.45;
    parts.push({ geometry: box(0.05, 0.9, 1.1), color: GLASS, position: [-1.26, 2.3, z] });
    parts.push({ geometry: box(0.05, 0.9, 1.1), color: GLASS, position: [1.26, 2.3, z] });
  }
  return parts;
}

function camper(): ColoredPart[] {
  return [
    ...van(WHITE),
    { geometry: box(2.04, 0.35, 4.84), color: '#2f8fd0', position: [0, 1.5, 0] },
    { geometry: box(1.7, 0.5, 2.6), color: '#f2ecd9', position: [0, 2.6, 0.6] },
  ];
}

/** Geometry variants per kind (cars come in several colours). Built once, shared by the pool. */
export function buildTrafficGeometries(kinds: readonly TrafficKind[]): Map<TrafficKind, THREE.BufferGeometry[]> {
  const out = new Map<TrafficKind, THREE.BufferGeometry[]>();
  for (const kind of new Set(kinds)) {
    switch (kind) {
      case 'car':
        out.set(kind, CAR_COLORS.map((c) => buildColoredGeometry(carParts(c))));
        break;
      case 'pickup':
        out.set(kind, ['#3d7be0', '#e8453c', '#6b6f75'].map((c) => buildColoredGeometry(pickup(c))));
        break;
      case 'van':
        out.set(kind, ['#2fb5a8', '#f2f2f2', '#f2c230'].map((c) => buildColoredGeometry(van(c))));
        break;
      case 'dumpTruck': {
        const { body, bed } = dumpTruckParts();
        // Bed resting flat on the chassis.
        out.set(kind, [buildColoredGeometry([...body, ...bed])]);
        break;
      }
      case 'mixer':
        out.set(kind, [buildColoredGeometry(mixer())]);
        break;
      case 'tractor':
        out.set(kind, [buildColoredGeometry(tractorParts())]);
        break;
      case 'cityBus':
        out.set(kind, [buildColoredGeometry(cityBus())]);
        break;
      case 'camper':
        out.set(kind, [buildColoredGeometry(camper())]);
        break;
    }
  }
  return out;
}

export const HALF_WIDTH: Record<TrafficKind, number> = {
  car: 0.9,
  pickup: 0.95,
  van: 1,
  dumpTruck: 1.3,
  mixer: 1.25,
  tractor: 1.05,
  cityBus: 1.25,
  camper: 1,
};

/** Slow vehicles (tractors) travel slower than the rest. */
export const SPEED_FACTOR: Partial<Record<TrafficKind, number>> = { tractor: 0.6, mixer: 0.85, dumpTruck: 0.85 };
