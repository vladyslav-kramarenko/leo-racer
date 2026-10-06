import * as THREE from 'three';
import type { FlypastPreset } from './presets/types';
import type { RoadFrame, RoadGenerator } from './RoadGenerator';

interface FlightPath {
  firstDelay: number;
  duration: number;
  halfWidth: number;
  ahead: number;
  forwardRatio: number;
}

/** Reuses one model for diagonal road crossings; the path is fixed when each flight starts. */
export class RoadFlypast {
  readonly group = new THREE.Group();
  private frame: RoadFrame | null = null;
  private startS = 0;
  private forwardSpeed = 0;
  private age: number | null = null;
  private direction = 1;
  private nextFlightIn: number;
  private previousProgress = 0;

  constructor(private readonly road: RoadGenerator, private readonly cfg: FlypastPreset,
    private readonly path: FlightPath, private readonly rng: () => number = Math.random) {
    this.nextFlightIn = path.firstDelay;
    this.group.visible = false;
  }

  isFlying(): boolean { return this.age !== null; }

  update(dt: number, progress: number): void {
    if (dt <= 0) return;
    const speed = Math.max(0, Math.min(50, (progress - this.previousProgress) / dt));
    this.previousProgress = progress;
    if (this.age === null) {
      this.nextFlightIn -= dt;
      if (this.nextFlightIn > 0) return;
      // Aim ahead of the bus at mid-flight, including when accelerating. Once spawned,
      // the route runs in world space without following subsequent driver input.
      this.forwardSpeed = speed * this.path.forwardRatio;
      this.startS = progress + (speed - this.forwardSpeed) * this.path.duration / 2 + this.path.ahead;
      this.frame = this.road.frame(this.startS);
      this.age = 0;
      this.group.visible = true;
    } else this.age += dt;
    if (this.age >= this.path.duration) {
      this.age = null;
      this.group.visible = false;
      this.direction *= -1;
      const [low, high] = this.cfg.intervalSec;
      this.nextFlightIn = low + this.rng() * (high - low);
      return;
    }
    const f = this.age / this.path.duration;
    const lateral = this.direction * this.path.halfWidth * (2 * f - 1);
    const frame = this.road.frame(this.startS + this.forwardSpeed * this.age, this.frame!);
    this.group.position.set(frame.x + frame.rx * lateral, this.cfg.altitude + Math.sin(f * Math.PI) * 1.2,
      frame.z + frame.rz * lateral);
    this.group.rotation.set(0, -this.direction * Math.atan2(2 * this.path.halfWidth / this.path.duration, this.forwardSpeed)
      - frame.heading, Math.sin(f * Math.PI * 2) * 0.025);
  }
}
