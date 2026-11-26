import { CONFIG } from '../game/config';
import { approach, clamp } from '../input/SteeringState';

export interface AutopilotInput {
  timeSec: number;
  dtSec: number;
  lateralOffset: number;
  lateralVelocity: number;
  /** Signed road curvature ahead (1/m, positive = curving right). */
  curvatureAhead: number;
  /** 0 = normal driving, 1 = fully pulled over to `pullOverOffset` (session ending). */
  pullOver?: number;
  pullOverOffset?: number;
}

type AutopilotConfig = typeof CONFIG.autopilot;

/**
 * Keeps the vehicle near the road centre with a slow, organic wander,
 * leaning slightly into upcoming curves. Never random, never abrupt.
 */
export class Autopilot {
  private readonly phase: number[];
  private last = 0;

  constructor(
    private readonly cfg: AutopilotConfig = CONFIG.autopilot,
    seed = Math.random() * 1000,
  ) {
    this.phase = cfg.wander.map((_, i) => seed * (i + 1.7));
  }

  targetOffset(timeSec: number, curvatureAhead: number): number {
    let target = 0;
    this.cfg.wander.forEach((w, i) => {
      target += w.amplitude * Math.sin((2 * Math.PI * timeSec) / w.period + this.phase[i]);
    });
    // Positive curvature = road bends right → drift slightly right (inside).
    target += curvatureAhead * this.cfg.curveLean;
    return target;
  }

  getSteering(input: AutopilotInput): number {
    const pull = clamp(input.pullOver ?? 0, 0, 1);
    const wander = this.targetOffset(input.timeSec, input.curvatureAhead);
    const target = wander + ((input.pullOverOffset ?? 0) - wander) * pull;
    const error = target - input.lateralOffset;
    const raw = clamp(
      this.cfg.gain * error - this.cfg.damping * input.lateralVelocity,
      -this.cfg.maxSteering,
      this.cfg.maxSteering,
    );
    // Slew-rate limit: the autopilot never yanks the wheel.
    this.last = approach(this.last, raw, this.cfg.maxSteeringRate * Math.max(0, input.dtSec));
    return this.last;
  }
}
