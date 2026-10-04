import type * as THREE from 'three';
import { buildColoredGeometry } from '../world/geometry';
import type { TrafficKind } from '../world/presets/types';
import {
  camperParts,
  carParts,
  cityBusParts,
  dumpTruckParts,
  mixerParts,
  pickupParts,
  tractorParts,
  vanParts,
} from '../world/toyParts';

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

/** Geometry variants per kind (cars come in several colours). Built once, shared by the pool. */
export function buildTrafficGeometries(kinds: readonly TrafficKind[]): Map<TrafficKind, THREE.BufferGeometry[]> {
  const out = new Map<TrafficKind, THREE.BufferGeometry[]>();
  for (const kind of new Set(kinds)) {
    switch (kind) {
      case 'car':
        out.set(kind, CAR_COLORS.map((c) => buildColoredGeometry(carParts(c))));
        break;
      case 'pickup':
        out.set(kind, ['#3d7be0', '#e8453c', '#6b6f75'].map((c) => buildColoredGeometry(pickupParts(c))));
        break;
      case 'van':
        out.set(kind, ['#2fb5a8', '#f2f2f2', '#f2c230'].map((c) => buildColoredGeometry(vanParts(c))));
        break;
      case 'dumpTruck': {
        // Bed resting flat on the chassis.
        const { body, bed } = dumpTruckParts();
        out.set(kind, [buildColoredGeometry([...body, ...bed])]);
        break;
      }
      case 'mixer':
        out.set(kind, [buildColoredGeometry(mixerParts())]);
        break;
      case 'tractor':
        out.set(kind, [buildColoredGeometry(tractorParts())]);
        break;
      case 'cityBus':
        out.set(kind, [buildColoredGeometry(cityBusParts())]);
        break;
      case 'camper':
        out.set(kind, [buildColoredGeometry(camperParts())]);
        break;
    }
  }
  return out;
}

export const HALF_WIDTH: Record<TrafficKind, number> = {
  car: 0.95,
  pickup: 1,
  van: 1.05,
  dumpTruck: 1.35,
  mixer: 1.35,
  tractor: 1.25,
  cityBus: 1.3,
  camper: 1.05,
};

/** Slow vehicles (tractors) travel slower than the rest. */
export const SPEED_FACTOR: Partial<Record<TrafficKind, number>> = { tractor: 0.6, mixer: 0.85, dumpTruck: 0.85 };
