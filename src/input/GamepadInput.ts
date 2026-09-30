import { CONFIG } from '../game/config';
import { normalizeAxis, type SteeringInput, type WheelCalibration } from './SteeringState';

export interface GamepadSnapshot {
  id: string;
  index: number;
  axes: readonly number[];
  buttons: readonly boolean[];
}

type GamepadProvider = () => ReadonlyArray<Gamepad | null>;

const defaultProvider: GamepadProvider = () =>
  typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];

/**
 * Generic Gamepad API steering. No device-specific assumptions: a wheel is just a
 * gamepad whose steering axis was found by calibration (axis 0 before that).
 */
export class GamepadInput implements SteeringInput {
  private steering = 0;
  private raw = 0;
  private connected: GamepadSnapshot | null = null;
  private prevButtons: boolean[] = [];
  private hornListener: (() => void) | null = null;
  private calibration: WheelCalibration | null = null;

  constructor(private readonly provider: GamepadProvider = defaultProvider) {}

  setCalibration(cal: WheelCalibration | null): void {
    this.calibration = cal;
  }

  getCalibration(): WheelCalibration | null {
    return this.calibration;
  }

  onHorn(listener: () => void): void {
    this.hornListener = listener;
  }

  /** Poll all pads; prefer the calibrated device, else the first connected pad. */
  update(): void {
    const pads = this.snapshots();
    const pad =
      (this.calibration && pads.find((p) => p.id === this.calibration!.gamepadId)) || pads[0] || null;

    if (!pad) {
      this.connected = null;
      this.steering = 0;
      this.raw = 0;
      this.prevButtons = [];
      return;
    }

    if (this.connected?.index !== pad.index) this.prevButtons = pad.buttons.slice();
    this.connected = pad;

    const cal = this.calibration && this.calibration.gamepadId === pad.id ? this.calibration : null;
    const axis = cal ? cal.steeringAxis : CONFIG.gamepad.defaultAxis;
    this.raw = pad.axes[axis] ?? 0;
    this.steering = normalizeAxis(
      this.raw,
      cal ?? { min: -1, center: 0, max: 1, invertAxis: false, deadzone: CONFIG.gamepad.deadzone },
    );

    // Any wheel/pad button press honks (rising edge only).
    const pressedNow = pad.buttons.some((b, i) => b && !this.prevButtons[i]);
    if (pressedNow) this.hornListener?.();
    this.prevButtons = pad.buttons.slice();
  }

  getSteering(): number {
    return this.steering;
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
