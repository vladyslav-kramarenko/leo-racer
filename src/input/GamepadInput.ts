import { CONFIG } from '../game/config';
import { HapticFeedback, type HapticActuator } from './HapticFeedback';
import { normalizeAxis, normalizePedal, type SteeringInput, type WheelCalibration } from './SteeringState';

export interface GamepadSnapshot {
  id: string;
  index: number;
  axes: readonly number[];
  buttons: readonly boolean[];
  hapticActuator?: HapticActuator;
}

type GamepadProvider = () => ReadonlyArray<Gamepad | null>;

const defaultProvider: GamepadProvider = () =>
  typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];

/**
 * Generic Gamepad API steering. No device-specific assumptions: a wheel is just a
 * gamepad whose steering axis was found by calibration (axis 0 before that).
 */
export class GamepadInput implements SteeringInput {
  readonly haptics = new HapticFeedback(() => this.connected?.hapticActuator ?? null);
  private steering = 0;
  private raw = 0;
  private brake = 0;
  private throttle = 0;
  private connected: GamepadSnapshot | null = null;
  private prevButtons: boolean[] = [];
  private hornListener: (() => void) | null = null;
  private shiftListener: ((direction: -1 | 1) => void) | null = null;
  private buttonsNeedBaseline = true;
  private calibration: WheelCalibration | null = null;

  constructor(private readonly provider: GamepadProvider = defaultProvider) {}

  setCalibration(cal: WheelCalibration | null): void {
    this.calibration = cal;
    this.buttonsNeedBaseline = true;
    this.brake = 0;
    this.throttle = 0;
  }

  getCalibration(): WheelCalibration | null {
    return this.calibration;
  }

  onHorn(listener: () => void): void {
    this.hornListener = listener;
  }

  onShift(listener: (direction: -1 | 1) => void): void {
    this.shiftListener = listener;
  }

  /** Poll all pads; prefer the calibrated device, else the first connected pad. */
  update(): void {
    const pads = this.snapshots();
    const pad =
      (this.calibration && pads.find((p) => p.id === this.calibration!.gamepadId)) || pads[0] || null;

    if (!pad) {
      if (this.connected) this.haptics.stop();
      this.connected = null;
      this.steering = 0;
      this.raw = 0;
      this.brake = 0;
      this.throttle = 0;
      this.prevButtons = [];
      return;
    }

    if (this.connected?.index !== pad.index || this.connected?.id !== pad.id || this.buttonsNeedBaseline) {
      this.haptics.stop();
      this.prevButtons = pad.buttons.slice();
      this.buttonsNeedBaseline = false;
    }
    this.connected = pad;

    const cal = this.calibration && this.calibration.gamepadId === pad.id ? this.calibration : null;
    const axis = cal ? cal.steeringAxis : CONFIG.gamepad.defaultAxis;
    this.raw = pad.axes[axis] ?? 0;
    this.steering = normalizeAxis(
      this.raw,
      cal ?? { min: -1, center: 0, max: 1, invertAxis: false, deadzone: CONFIG.gamepad.deadzone },
    );
    const brakeRaw = cal?.brake ? pad.axes[cal.brake.axis] : undefined;
    this.brake = cal?.brake && brakeRaw !== undefined ? normalizePedal(brakeRaw, cal.brake) : 0;
    const throttleRaw = cal?.throttle ? pad.axes[cal.throttle.axis] : undefined;
    this.throttle = cal?.throttle && throttleRaw !== undefined ? normalizePedal(throttleRaw, cal.throttle) : 0;

    const up = cal?.gearButtons?.up ?? 5;
    const down = cal?.gearButtons?.down ?? 4;
    const upPressed = !!pad.buttons[up] && !this.prevButtons[up];
    const downPressed = !!pad.buttons[down] && !this.prevButtons[down];
    if (up !== down && upPressed !== downPressed) this.shiftListener?.(upPressed ? 1 : -1);
    // Shift buttons are reserved; other buttons still honk on the rising edge.
    const pressedNow = pad.buttons.some((b, i) => i !== up && i !== down && b && !this.prevButtons[i]);
    if (pressedNow) this.hornListener?.();
    this.prevButtons = pad.buttons.slice();
  }

  getSteering(): number {
    return this.steering;
  }

  getBrake(): number {
    return this.brake;
  }

  isBraking(): boolean {
    return this.brake > 0.1;
  }

  getThrottle(): number {
    return this.throttle;
  }

  isAccelerating(): boolean {
    return this.throttle > 0.1;
  }

  getRaw(): number {
    return this.raw;
  }

  getConnected(): GamepadSnapshot | null {
    return this.connected;
  }

  /** All currently connected pads, for calibration and diagnostics. */
  snapshots(): GamepadSnapshot[] {
    const result: GamepadSnapshot[] = [];
    let list: ReadonlyArray<Gamepad | null>;
    try {
      list = this.provider();
    } catch {
      return result;
    }
    for (const gp of list) {
      if (!gp || !gp.connected) continue;
      result.push({
        id: gp.id,
        index: gp.index,
        axes: Array.from(gp.axes),
        buttons: gp.buttons.map((b) => b.pressed),
        hapticActuator: gp.vibrationActuator,
      });
    }
    return result;
  }
}

export interface AxisRange {
  axis: number;
  min: number;
  max: number;
}

/**
 * Tracks min/max of every axis while the parent turns the wheel.
 * The axis with the largest range is the steering axis.
 */
export class CalibrationRecorder {
  private readonly ranges = new Map<number, AxisRange>();

  constructor(readonly gamepadId: string) {}

  sample(axes: readonly number[]): void {
    axes.forEach((value, axis) => {
      if (!Number.isFinite(value)) return;
      const r = this.ranges.get(axis);
      if (!r) this.ranges.set(axis, { axis, min: value, max: value });
      else {
        r.min = Math.min(r.min, value);
        r.max = Math.max(r.max, value);
      }
    });
  }

  best(): AxisRange | null {
    let best: AxisRange | null = null;
    for (const r of this.ranges.values()) {
      if (!best || r.max - r.min > best.max - best.min) best = r;
    }
    return best;
  }

  allRanges(): AxisRange[] {
    return [...this.ranges.values()].sort((a, b) => a.axis - b.axis);
  }

  /** Build a calibration from the recorded data (not yet direction-checked). */
  build(deadzone: number = CONFIG.gamepad.deadzone): WheelCalibration | null {
    const best = this.best();
    if (!best || best.max - best.min < CONFIG.gamepad.minCalibrationRange) return null;
    return {
      gamepadId: this.gamepadId,
      steeringAxis: best.axis,
      invertAxis: false,
      min: best.min,
      max: best.max,
      center: (best.min + best.max) / 2,
      deadzone,
    };
  }
}
