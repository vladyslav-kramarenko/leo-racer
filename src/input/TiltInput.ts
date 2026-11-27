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
  return tiltFromGravity(gx, gy, screenAngleDeg);
}

export function tiltFromGravity(gx: number, gy: number, screenAngleDeg: number): number {
  const { sx, sy } = toScreen(gx, gy, screenAngleDeg);
  return (Math.atan2(sx, Math.max(-sy, 0.6)) * 180) / Math.PI;
}

/** Acceleration including gravity is opposite to the physical gravity vector. */
export function motionGravity(x: number, y: number, z: number): { gx: number; gy: number } | null {
  const norm = Math.hypot(x, y, z);
  if (!Number.isFinite(norm) || norm < 4 || norm > 16) return null;
  return { gx: -x / norm, gy: -y / norm };
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

/** Safari has reported inverted landscape angles via ScreenOrientation (WebKit #254863).
 * On permission-based iOS sensor implementations prefer the legacy physical angle. */
export function resolveScreenAngle(modern: number | undefined, legacy: number | undefined, preferLegacy: boolean): number {
  const valid = (a: number | undefined): a is number => typeof a === 'number' && Number.isFinite(a) && a % 90 === 0;
  const angle = preferLegacy && valid(legacy) ? legacy : valid(modern) ? modern : valid(legacy) ? legacy : 0;
  return ((angle % 360) + 360) % 360;
}

function permissionBasedSensors(): boolean {
  return (typeof DeviceOrientationEvent !== 'undefined' &&
    typeof (DeviceOrientationEvent as PermissionedSensor).requestPermission === 'function') ||
    (typeof DeviceMotionEvent !== 'undefined' &&
    typeof (DeviceMotionEvent as PermissionedSensor).requestPermission === 'function');
}

function currentScreenAngle(): number {
  const modern = typeof screen !== 'undefined' ? screen.orientation?.angle : undefined;
  const legacy = (window as unknown as { orientation?: number }).orientation;
  return resolveScreenAngle(modern, legacy, permissionBasedSensors());
}

/** At neutral calibration only, correct clearly inconsistent sensor axes.
 * The phone is held upright like a wheel: gravity should point mostly screen-down.
 * Never infer an axis from a nearly flat device or remap while steering. */
export function calibratedScreenAngle(gx: number, gy: number, reported: number): number {
  const magnitude = Math.hypot(gx, gy);
  if (magnitude < 0.6) return reported;
  if (-toScreen(gx, gy, reported).sy >= 0.5 * magnitude) return reported;
  const best = [0, 90, 180, 270].reduce((a, b) =>
    toScreen(gx, gy, b).sy < toScreen(gx, gy, a).sy ? b : a, reported);
  return -toScreen(gx, gy, best).sy >= 0.85 * magnitude ? best : reported;
}

type PermissionedSensor = { requestPermission?: () => Promise<'granted' | 'denied'> };
type TiltSource = 'orientation' | 'motion';
const SIGNAL_TIMEOUT = 1500;

async function requestSensor(ctor: PermissionedSensor | undefined): Promise<boolean> {
  if (!ctor) return false;
  try { return typeof ctor.requestPermission !== 'function' || await ctor.requestPermission() === 'granted'; }
  catch { return false; }
}

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
  private lastEventAt = -Infinity;
  private lastOrientationAt = -Infinity;
  private screenAngle: number | null = null;
  private steeringAngle: number | null = null;
  private gravity: { gx: number; gy: number } | null = null;
  private source: TiltSource | null = null;
  private pending: Promise<boolean> | null = null;
  private generation = 0;

  constructor(private readonly cfg: TiltConfig = CONFIG.tilt) {}

  static isSupported(): boolean {
    return typeof window !== 'undefined' && ('DeviceOrientationEvent' in window || 'DeviceMotionEvent' in window);
  }

  /** Touch-first devices (tablets, phones) get tilt by default. */
  static isTouchFirst(): boolean {
    return typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  }

  /** Call from a user gesture (iOS asks for permission). Resolves false if unavailable. */
  enable(): Promise<boolean> {
    if (!TiltInput.isSupported()) return Promise.resolve(false);
    if (this.listening) return Promise.resolve(true);
    if (this.pending) return this.pending;
    const generation = ++this.generation;
    const orientation = typeof DeviceOrientationEvent === 'undefined' ? undefined : DeviceOrientationEvent as PermissionedSensor;
    const motion = typeof DeviceMotionEvent === 'undefined' ? undefined : DeviceMotionEvent as PermissionedSensor;
    // Both requests start synchronously in the same user gesture (required by iOS).
    this.pending = Promise.all([requestSensor(orientation), requestSensor(motion)]).then(([o, m]) => {
      if (generation !== this.generation) return false;
      if (!o && !m) return false;
      if (o) window.addEventListener('deviceorientation', this.onOrientation);
      if (m) window.addEventListener('devicemotion', this.onMotion);
      this.listening = true;
      this.recenter();
      return true;
    }).finally(() => {
      if (generation === this.generation) this.pending = null;
    });
    return this.pending;
  }

  disable(): void {
    this.generation++;
    this.pending = null;
    window.removeEventListener('deviceorientation', this.onOrientation);
    window.removeEventListener('devicemotion', this.onMotion);
    this.listening = false;
    this.lastOrientationAt = -Infinity;
    this.lastEventAt = -Infinity;
    this.source = null;
    this.screenAngle = null;
    this.steeringAngle = null;
    this.gravity = null;
    this.raw = null;
    this.center = null;
    this.smoothed = 0;
  }

  isEnabled(): boolean {
    return this.listening;
  }

  /** True once real orientation events are arriving. */
  hasSignal(): boolean {
    return this.listening && this.raw !== null && performance.now() - this.lastEventAt < SIGNAL_TIMEOUT;
  }

  getSignalSource(): TiltSource | null {
    return this.hasSignal() ? this.source : null;
  }

  /** The next reading becomes "straight ahead". */
  recenter(): void {
    this.center = null;
    this.steeringAngle = null;
    this.smoothed = 0;
  }

  /** Local diagnostic only: reported screen angle, calibrated axis and gravity components. */
  getAxisDiagnostics(): string {
    if (!this.hasSignal() || !this.gravity) return '';
    return `screen ${this.screenAngle}° / axis ${this.steeringAngle}° · x ${this.gravity.gx.toFixed(2)} y ${this.gravity.gy.toFixed(2)}`;
  }

  setInverted(invert: boolean): void {
    this.invert = invert;
  }

  update(dtMs: number): void {
    if (!this.hasSignal() || this.raw === null || this.center === null) {
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
    if (typeof e.beta !== 'number' || typeof e.gamma !== 'number' ||
        !Number.isFinite(e.beta) || !Number.isFinite(e.gamma)) return;
    const now = performance.now();
    this.lastOrientationAt = now;
    const screenAngle = currentScreenAngle();
    const { gx, gy } = gravityFromEuler(e.beta, e.gamma);
    this.accept(gx, gy, screenAngle, 'orientation', now);
  };

  private readonly onMotion = (e: DeviceMotionEvent): void => {
    const now = performance.now();
    // Prefer the browser's fused orientation while it supplies valid readings.
    if (now - this.lastOrientationAt < SIGNAL_TIMEOUT) return;
    const a = e.accelerationIncludingGravity;
    if (!a || typeof a.x !== 'number' || typeof a.y !== 'number' || typeof a.z !== 'number') return;
    const g = motionGravity(a.x, a.y, a.z);
    if (!g) return;
    const screenAngle = currentScreenAngle();
    this.accept(g.gx, g.gy, screenAngle, 'motion', now);
  };

  private accept(gx: number, gy: number, screenAngle: number, source: TiltSource, now: number): void {
    if (this.source !== source || this.screenAngle !== screenAngle || now - this.lastEventAt >= SIGNAL_TIMEOUT) {
      this.recenter();
    }
    this.source = source;
    this.screenAngle = screenAngle;
    this.gravity = { gx, gy };
    // Only permission-based mobile sensors need this compatibility calibration.
    this.steeringAngle ??= permissionBasedSensors() ? calibratedScreenAngle(gx, gy, screenAngle) : screenAngle;
    this.raw = tiltFromGravity(gx, gy, this.steeringAngle);
    this.lastEventAt = now;
    this.center ??= this.raw;
  }
}
