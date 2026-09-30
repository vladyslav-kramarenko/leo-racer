import type * as THREE from 'three';
import type { VehicleState } from '../driving/VehicleController';

/** Visual representation of a player vehicle. Driving logic never depends on it. */
export interface VehicleModel {
  readonly object: THREE.Object3D;
  /** Animate wheels, body lean, etc. */
  animate(dtSec: number, state: VehicleState, timeSec: number): void;
}
