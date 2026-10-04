import { CONFIG } from '../game/config';
import { applyDeadzone, clamp, type SteeringInput } from './SteeringState';

type TiltConfig = typeof CONFIG.tilt;

/**
 * Gravity direction in device coordinates from DeviceOrientation Euler angles
 * (W3C intrinsic Z-X'-Y''). x = device right, y = device top (natural orientation).
 * Only the in-screen components matter for steering.
 */
export function gravityFromEuler(betaDeg: number, gammaDeg: number): { gx: number; gy: number } {
  const b = (betaDeg * Math.PI) / 180;
  const g = (gammaDeg * Math.PI) / 180;
  return { gx: Math.cos(b) * Math.sin(g), gy: -Math.sin(b) };
}

/** Rotate a device-frame vector into screen coordinates (sx = screen right, sy = screen up). */
export function toScreen(gx: number, gy: number, screenAngleDeg: number): { sx: number; sy: number } {
  const a = (screenAngleDeg * Math.PI) / 180;
  return { sx: gx * Math.cos(a) - gy * Math.sin(a), sy: gx * Math.sin(a) + gy * Math.cos(a) };
}

/**
 * Signed tilt angle in degrees: positive = device turned clockwise (like a wheel to the right).
 * Works for a tablet held upright like a wheel and for one tilted back in the lap.
 * Near flat, the vertical component is floored so tiny wobbles don't become full lock.
 */
export function tiltAngleDeg(betaDeg: number, gammaDeg: number, screenAngleDeg: number): number {
  const { gx, gy } = gravityFromEuler(betaDeg, gammaDeg);
  const { sx, sy } = toScreen(gx, gy, screenAngleDeg);
  return (Math.atan2(sx, Math.max(-sy, 0.6)) * 180) / Math.PI;
}

/** Wrap an angle difference into [-180, 180). */
export function angleDiff(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

/** Map a tilt relative to centre onto -1..1 with dead zone and full-lock clamp. */
export function tiltToSteering(angleDeg: number, centerDeg: number, cfg: { deadZoneDeg: number; fullLockDeg: number }): number {
  const rel = angleDiff(angleDeg, centerDeg);
  const normalized = clamp(rel / cfg.fullLockDeg, -1, 1);
  return applyDeadzone(normalized, cfg.deadZoneDeg / cfg.fullLockDeg);
}

function currentScreenAngle(): number {
  let angle = typeof screen !== 'undefined' ? screen.orientation?.angle : undefined;
  // Older iOS Safari only has the legacy window.orientation (90 / -90).
  angle ??= (window as unknown as { orientation?: number }).orientation ?? 0;
  return ((angle % 360) + 360) % 360;
}

type PermissionedOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

/**
 * Tablet/phone tilt steering via the DeviceOrientation API.
 * The orientation at enable() (START) or recenter() is "straight ahead".
 * If the API is missing or permission is denied, it simply stays at 0.
 */
export class TiltInput implements SteeringInput {
  private raw: number | null = null;
  private center: number | null = null;
  private smoothed = 0;
  private invert = false;
  private listening = false;
  private lastEventAt = 0;

  constructor(private readonly cfg: TiltConfig = CONFIG.tilt) {}

  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
  }

  /** Touch-first devices (tablets, phones) get tilt by default. */
  static isTouchFirst(): boolean {
    return typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  }

  /** Call from a user gesture (iOS asks for permission). Resolves false if unavailable. */
  async enable(): Promise<boolean> {
    if (!TiltInput.isSupported()) return false;
    if (this.listening) return true;
    const Ctor = DeviceOrientationEvent as PermissionedOrientationEvent;
    if (typeof Ctor.requestPermission === 'function') {
      try {
        if ((await Ctor.requestPermission()) !== 'granted') return false;
      } catch {
        return false;
      }
    }
    window.addEventListener('deviceorientation', this.onOrientation);
    this.listening = true;
    this.center = null;
    return true;
  }

  disable(): void {
    window.removeEventListener('deviceorientation', this.onOrientation);
    this.listening = false;
    this.raw = null;
    this.smoothed = 0;
  }

  isEnabled(): boolean {
    return this.listening;
  }

  /** True once real orientation events are arriving. */
  hasSignal(): boolean {
    return this.listening && this.raw !== null && performance.now() - this.lastEventAt < 1000;
  }

  /** The next reading becomes "straight ahead". */
  recenter(): void {
    this.center = null;
    this.smoothed = 0;
  }

  setInverted(invert: boolean): void {
    this.invert = invert;
  }

  update(dtMs: number): void {
    if (this.raw === null || this.center === null) {
      this.smoothed = 0;
      return;
    }
    const target = tiltToSteering(this.raw, this.center, this.cfg) * (this.invert ? -1 : 1);
    // Frame-rate independent low-pass filter (smoothing is defined per 60 Hz frame).
    const k = 1 - Math.pow(1 - this.cfg.smoothing, Math.max(0, dtMs) / (1000 / 60));
    this.smoothed += (target - this.smoothed) * k;
    if (Math.abs(this.smoothed) < 1e-4) this.smoothed = 0;
  }

  getSteering(): number {
    return this.smoothed;
  }

  /** Raw tilt angle in degrees relative to centre (diagnostics). */
  getRelativeAngle(): number {
    return this.raw === null || this.center === null ? 0 : angleDiff(this.raw, this.center);
  }

  private readonly onOrientation = (e: DeviceOrientationEvent): void => {
    if (e.beta === null || e.gamma === null) return;
    this.raw = tiltAngleDeg(e.beta, e.gamma, currentScreenAngle());
    this.lastEventAt = performance.now();
    this.center ??= this.raw;
  };
}
