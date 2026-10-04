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
