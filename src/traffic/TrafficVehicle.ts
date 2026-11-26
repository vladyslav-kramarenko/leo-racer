import type * as THREE from 'three';
import { buildColoredGeometry } from '../world/geometry';
import type { TrafficKind } from '../world/presets/types';
import { skiPickupParts, snowplowParts } from '../world/winterVehicles';
import {
  camperParts,
  carParts,
  cityBusParts,
  dumpTruckParts,
  mixerParts,
  pickupParts,
  policeParts,
  sportsCarParts,
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
  /** Comes from behind and passes the bus. */
  overtaking: boolean;
  /** Already went past the bus (for the "zoom" sound). */
  passed: boolean;
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
      case 'skiPickup':
        out.set(kind, ['#318caa', '#c65a53'].map((c) => buildColoredGeometry(skiPickupParts(c))));
        break;
      case 'snowplow':
        out.set(kind, [buildColoredGeometry(snowplowParts())]);
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
      case 'sportsCar':
        // Classic 80s supercar colours.
        out.set(kind, ['#e8302a', '#f2f2f2', '#ffc21a'].map((c) => buildColoredGeometry(sportsCarParts(c))));
        break;
      case 'police':
        // Two frames of the flashing light bar; the manager alternates them.
        out.set(kind, [buildColoredGeometry(policeParts('red')), buildColoredGeometry(policeParts('blue'))]);
        break;
    }
  }
  return out;
}

export const HALF_WIDTH: Record<TrafficKind, number> = {
  car: 0.95,
  pickup: 1,
  skiPickup: 1.15,
  snowplow: 1.5,
  van: 1.05,
  dumpTruck: 1.35,
  mixer: 1.35,
  tractor: 1.25,
  cityBus: 1.3,
  camper: 1.05,
  sportsCar: 1.0,
  police: 1.05,
};

/** Kinds whose geometry variants are animation frames (flashing lights), not colour choices. */
export const FLASHING: ReadonlySet<TrafficKind> = new Set(['police']);

/** Slow vehicles (tractors) travel slower than the rest. */
export const SPEED_FACTOR: Partial<Record<TrafficKind, number>> = {
  tractor: 0.6,
  snowplow: 0.7,
  mixer: 0.85,
  dumpTruck: 0.85,
};
