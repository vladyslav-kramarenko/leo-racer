/** Shared steering helpers and types. Steering is always normalised to -1 (left) … +1 (right). */

export type InputSource = 'none' | 'keyboard' | 'gamepad' | 'tilt' | 'touch';

export interface SteeringInput {
  /** -1 = full left, 0 = centre, +1 = full right. */
  getSteering(): number;
}

export interface WheelCalibration {
  gamepadId: string;
  steeringAxis: number;
  invertAxis: boolean;
  min: number;
  center: number;
  max: number;
  deadzone: number;
  /** Optional for compatibility with existing steering-only settings. */
  brake?: PedalCalibration;
  throttle?: PedalCalibration;
  gearButtons?: { up: number; down: number };
  secondaryGearButtons?: { up: number; down: number } | null;
}

export interface PedalCalibration {
  axis: number;
  released: number;
  pressed: number;
}

/** Supports separate or combined pedal axes, in either direction. */
export function normalizePedal(raw: number, cal: PedalCalibration): number {
  const span = cal.pressed - cal.released;
  if (!Number.isFinite(raw) || !Number.isFinite(span) || Math.abs(span) < 0.1) return 0;
  return Math.max(0, Math.min(1, (raw - cal.released) / span));
}

/** Ignore pedal jitter; map its active travel linearly from 1.5× to 3×. */
export function pedalSpeedMultiplier(throttle: number): number {
  const deadzone = 0.1;
  if (!Number.isFinite(throttle) || throttle <= deadzone) return 1;
  const travel = (clamp(throttle, 0, 1) - deadzone) / (1 - deadzone);
  return 1.5 + travel * 1.5;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Remove small values around zero and rescale the remainder so the output
 * still reaches ±1 smoothly (no jump at the deadzone edge).
 */
export function applyDeadzone(value: number, deadzone: number): number {
  const magnitude = Math.abs(value);
  if (magnitude <= deadzone) return 0;
  const scaled = (magnitude - deadzone) / (1 - deadzone);
  return Math.sign(value) * Math.min(1, scaled);
}

/** Convert a raw axis reading into -1…+1 using calibration data. */
export function normalizeAxis(raw: number, cal: Pick<WheelCalibration, 'min' | 'center' | 'max' | 'invertAxis' | 'deadzone'>): number {
  if (!Number.isFinite(raw)) return 0;
  let value: number;
  if (raw >= cal.center) {
    const span = cal.max - cal.center;
    value = span > 1e-6 ? (raw - cal.center) / span : 0;
  } else {
    const span = cal.center - cal.min;
    value = span > 1e-6 ? (raw - cal.center) / span : 0;
  }
  value = clamp(value, -1, 1);
  if (cal.invertAxis) value = -value;
  return applyDeadzone(value, cal.deadzone);
}

/** Move `current` toward `target` by at most `maxDelta`. */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(target, current + maxDelta);
  if (current > target) return Math.max(target, current - maxDelta);
  return current;
}
