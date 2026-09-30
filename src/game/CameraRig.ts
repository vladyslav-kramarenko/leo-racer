import type * as THREE from 'three';
import type { RoadGenerator } from '../world/RoadGenerator';
import { CONFIG } from './config';

/**
 * Calm third-person chase camera. It is positioned in road coordinates, so it follows
 * the smooth road direction rather than the bus yaw, and only the sideways offset is
 * smoothed — no shake, no sudden rotation.
 */
export class CameraRig {
  private lateral = 0;
  private targetLateral = 0;
  private readonly p = { x: 0, z: 0 };

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly road: RoadGenerator,
  ) {}

  update(dtSec: number, progress: number, lateralOffset: number, steering: number): void {
    const cfg = CONFIG.camera;
    const k = 1 - Math.exp(-cfg.followRate * dtSec);
    this.lateral += (lateralOffset * 0.6 + steering * cfg.steerShift - this.lateral) * k;
    this.targetLateral += (lateralOffset * 0.8 - this.targetLateral) * k;

    this.road.point(progress - cfg.distance, this.lateral, this.p);
    this.camera.position.set(this.p.x, cfg.height, this.p.z);
    this.road.point(progress + cfg.lookAhead, this.targetLateral, this.p);
    this.camera.lookAt(this.p.x, 1.4, this.p.z);
  }
}
