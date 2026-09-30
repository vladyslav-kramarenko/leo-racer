import { CONFIG } from '../game/config';
import { approach, clamp } from '../input/SteeringState';

type DrivingConfig = typeof CONFIG.driving;

export interface VehicleState {
  /** Distance travelled along the road, metres. */
  progress: number;
  /** Offset from the road centre, metres (positive = right). */
  lateralOffset: number;
  lateralVelocity: number;
  steering: number;
  speed: number;
  /** True while the brake is held. */
  braking: boolean;
  /** Visual yaw relative to the road direction, radians. */
  yaw: number;
}

/**
 * Deliberately simple kinematic model — no physics engine.
 * The vehicle cruises forward at a constant speed; steering only changes lateral offset,
 * which is confined by a soft boundary (gentle push-back) and a hard boundary (clamp).
 * Holding the brake eases the vehicle to a stop; releasing it always drives on again.
 * Nothing the child does can crash, flip or strand the vehicle.
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
      braking: false,
      yaw: 0,
    };
  }

  update(dtSec: number, steering: number, braking = false): VehicleState {
    const s = this.state;
    const dt = clamp(Number.isFinite(dtSec) ? dtSec : 0, 0, 0.1);
    s.steering = clamp(Number.isFinite(steering) ? steering : 0, -1, 1);
    s.braking = braking === true;

    // Gentle braking and gentle pick-up; never reverses.
    const rate = s.braking ? this.cfg.brakeDecel : this.cfg.acceleration;
    const target = s.braking ? 0 : this.cfg.speed;
    s.speed = approach(s.speed, target, rate * dt);
    s.progress += s.speed * dt;

    // Sideways motion scales with forward speed: a stopped bus cannot slide.
    const speedFactor = s.speed / this.cfg.speed;

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
    targetVel *= speedFactor;

    const k = 1 - Math.exp(-this.cfg.lateralResponse * dt);
    s.lateralVelocity += (targetVel - s.lateralVelocity) * k;
    s.lateralOffset += s.lateralVelocity * dt;

    // Hard boundary: never leave the safe corridor.
    if (Math.abs(s.lateralOffset) > hardLimit) {
      s.lateralOffset = Math.sign(s.lateralOffset) * hardLimit;
      if (Math.sign(s.lateralVelocity) === Math.sign(s.lateralOffset)) s.lateralVelocity = 0;
    }

    const yawTarget = clamp(Math.atan2(s.lateralVelocity, Math.max(s.speed, 1)) * 1.6, -this.cfg.maxYaw, this.cfg.maxYaw);
    s.yaw += (yawTarget - s.yaw) * (1 - Math.exp(-8 * dt));
    return s;
  }
}
