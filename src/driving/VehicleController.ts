import { CONFIG } from '../game/config';
import { clamp } from '../input/SteeringState';

type DrivingConfig = typeof CONFIG.driving;

export interface VehicleState {
  /** Distance travelled along the road, metres. */
  progress: number;
  /** Offset from the road centre, metres (positive = right). */
  lateralOffset: number;
  lateralVelocity: number;
  steering: number;
  speed: number;
  /** Visual yaw relative to the road direction, radians. */
  yaw: number;
}

/**
 * Deliberately simple kinematic model — no physics engine.
 * The vehicle always moves forward; steering only changes lateral offset,
 * which is confined by a soft boundary (gentle push-back) and a hard boundary (clamp).
 * Nothing the child does can stop, crash or flip the vehicle.
 */
export class VehicleController {
  readonly state: VehicleState;

  constructor(private readonly cfg: DrivingConfig = CONFIG.driving) {
    this.state = {
      progress: 0,
      lateralOffset: 0,
      lateralVelocity: 0,
      steering: 0,
      speed: cfg.speed,
      yaw: 0,
    };
  }

  update(dtSec: number, steering: number): VehicleState {
    const s = this.state;
    const dt = clamp(Number.isFinite(dtSec) ? dtSec : 0, 0, 0.1);
    s.steering = clamp(Number.isFinite(steering) ? steering : 0, -1, 1);
    s.speed = this.cfg.speed;
    s.progress += s.speed * dt;

    // Lateral velocity follows steering smoothly.
    let targetVel = s.steering * this.cfg.maxLateralSpeed;

    // Soft boundary: outward motion fades out and a spring pulls back.
    const { softLimit, hardLimit } = this.cfg;
    const abs = Math.abs(s.lateralOffset);
    if (abs > softLimit) {
      const side = Math.sign(s.lateralOffset);
      const depth = clamp((abs - softLimit) / (hardLimit - softLimit), 0, 1);
      if (Math.sign(targetVel) === side) targetVel *= 1 - depth;
      targetVel -= side * this.cfg.softSpring * (abs - softLimit);
    }

    const k = 1 - Math.exp(-this.cfg.lateralResponse * dt);
    s.lateralVelocity += (targetVel - s.lateralVelocity) * k;
    s.lateralOffset += s.lateralVelocity * dt;

    // Hard boundary: never leave the safe corridor.
    if (Math.abs(s.lateralOffset) > hardLimit) {
      s.lateralOffset = Math.sign(s.lateralOffset) * hardLimit;
      if (Math.sign(s.lateralVelocity) === Math.sign(s.lateralOffset)) s.lateralVelocity = 0;
    }

    const yawTarget = clamp(Math.atan2(s.lateralVelocity, s.speed) * 1.6, -this.cfg.maxYaw, this.cfg.maxYaw);
    s.yaw += (yawTarget - s.yaw) * (1 - Math.exp(-8 * dt));
    return s;
  }
}
