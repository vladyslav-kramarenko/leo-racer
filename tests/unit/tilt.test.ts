import { describe, expect, it, vi } from 'vitest';
import { angleDiff, gravityFromEuler, tiltAngleDeg, tiltToSteering, toScreen, motionGravity, tiltFromGravity, TiltInput, resolveScreenAngle, calibratedScreenAngle } from '../../src/input/TiltInput';
import { isInZone } from '../../src/input/TouchBrake';

const cfg = { deadZoneDeg: 4, fullLockDeg: 28 };
const deg = (r: number) => (r * 180) / Math.PI;

/** Steering angle straight from a device-frame gravity vector (bypassing Euler angles). */
function angleFromGravity(gx: number, gy: number, screenAngle: number): number {
  const { sx, sy } = toScreen(gx, gy, screenAngle);
  return deg(Math.atan2(sx, Math.max(-sy, 0.6)));
}

describe('tilt → steering mapping', () => {
  it('centre = 0', () => {
    expect(tiltToSteering(10, 10, cfg)).toBe(0);
  });

  it('dead zone = 0', () => {
    expect(tiltToSteering(3.9, 0, cfg)).toBe(0);
    expect(tiltToSteering(-3.9, 0, cfg)).toBe(0);
    expect(tiltToSteering(5, 0, cfg)).toBeGreaterThan(0);
  });

  it('left/right signs', () => {
    expect(tiltToSteering(15, 0, cfg)).toBeGreaterThan(0);
    expect(tiltToSteering(-15, 0, cfg)).toBeLessThan(0);
  });

  it('full-lock clamp', () => {
    expect(tiltToSteering(28, 0, cfg)).toBe(1);
    expect(tiltToSteering(80, 0, cfg)).toBe(1);
    expect(tiltToSteering(-80, 0, cfg)).toBe(-1);
  });

  it('works across the ±180° wrap', () => {
    expect(angleDiff(179, -179)).toBeCloseTo(-2);
    expect(tiltToSteering(-170, 175, cfg)).toBeGreaterThan(0);
  });
});

describe('device orientation → tilt angle', () => {
  it('flat device: right edge down steers right', () => {
    expect(tiltAngleDeg(0, 10, 0)).toBeGreaterThan(0);
    expect(tiltAngleDeg(0, -10, 0)).toBeLessThan(0);
  });

  it('upright portrait facing the user is straight ahead', () => {
    expect(tiltAngleDeg(90, 0, 0)).toBeCloseTo(0);
    const g = gravityFromEuler(90, 0);
    expect(g.gy).toBeCloseTo(-1);
  });

  it('portrait: turning the device clockwise (wheel right) steers right', () => {
    // Clockwise turn by θ: gravity in device frame rotates counter-clockwise from (0,-1).
    const t = (20 * Math.PI) / 180;
    expect(angleFromGravity(Math.sin(t), -Math.cos(t), 0)).toBeCloseTo(20, 0);
  });

  it('landscape-left (screen angle 90): clockwise turn steers right', () => {
    // Device top points left; device -x is "down" on screen.
    expect(angleFromGravity(-1, 0, 90)).toBeCloseTo(0);
    const t = (20 * Math.PI) / 180;
    expect(angleFromGravity(-Math.cos(t), -Math.sin(t), 90)).toBeCloseTo(20, 0);
    expect(angleFromGravity(-Math.cos(t), Math.sin(t), 90)).toBeCloseTo(-20, 0);
  });

  it('landscape-right (screen angle 270): clockwise turn steers right', () => {
    // Device top points right; device +x is "down" on screen.
    expect(angleFromGravity(1, 0, 270)).toBeCloseTo(0);
    const t = (20 * Math.PI) / 180;
    expect(angleFromGravity(Math.cos(t), Math.sin(t), 270)).toBeCloseTo(20, 0);
    expect(angleFromGravity(Math.cos(t), -Math.sin(t), 270)).toBeCloseTo(-20, 0);
  });

  it('a nearly flat device does not jump to full lock on a tiny wobble', () => {
    expect(Math.abs(tiltAngleDeg(2, 3, 0))).toBeLessThan(10);
  });
});

describe('touch brake zone', () => {
  const el = { getBoundingClientRect: () => ({ top: 0, height: 1000 }) };
  it('only the bottom part of the screen brakes', () => {
    expect(isInZone({ clientY: 950 }, el, 0.28)).toBe(true);
    expect(isInZone({ clientY: 720 }, el, 0.28)).toBe(true);
    expect(isInZone({ clientY: 500 }, el, 0.28)).toBe(false);
    expect(isInZone({ clientY: 30 }, el, 0.28)).toBe(false);
  });
});

describe('motion fallback and live sensor lifecycle', () => {
  it('maps standard accelerometer gravity to the same screen steering', () => {
    const g = motionGravity(-3.35, 9.21, 0)!;
    expect(tiltFromGravity(g.gx, g.gy, 0)).toBeCloseTo(20, 0);
    expect(motionGravity(0, 0, 0)).toBeNull();
    expect(motionGravity(NaN, 0, 9.8)).toBeNull();
  });

  it('requests both permissions, falls back to motion, resets on screen rotation and ignores stale data', async () => {
    const target = new EventTarget();
    const orientation = { requestPermission: vi.fn(async () => 'granted') };
    const motion = { requestPermission: vi.fn(async () => 'granted') };
    const display = { orientation: { angle: 0 } };
    let now = 0;
    vi.stubGlobal('window', Object.assign(target, { DeviceOrientationEvent: orientation, DeviceMotionEvent: motion }));
    vi.stubGlobal('DeviceOrientationEvent', orientation);
    vi.stubGlobal('DeviceMotionEvent', motion);
    vi.stubGlobal('screen', display);
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
    const tilt = new TiltInput();
    const send = (x: number, y: number, z: number) =>
      target.dispatchEvent(Object.assign(new Event('devicemotion'), { accelerationIncludingGravity: { x, y, z } }));
    try {
      const enabled = tilt.enable();
      expect(orientation.requestPermission).toHaveBeenCalledOnce();
      expect(motion.requestPermission).toHaveBeenCalledOnce();
      expect(await enabled).toBe(true);
      expect(tilt.hasSignal()).toBe(false);
      send(0, 9.8, 0);
      now = 50;
      send(-3.35, 9.21, 0);
      tilt.update(200);
      expect(tilt.getSignalSource()).toBe('motion');
      expect(tilt.getSteering()).toBeGreaterThan(0.4);
      display.orientation.angle = 90;
      now = 100;
      send(9.8, 0, 0);
      tilt.update(200);
      expect(tilt.getSteering()).toBe(0);
      now = 200;
      target.dispatchEvent(Object.assign(new Event('deviceorientation'), { beta: 0, gamma: -90 }));
      expect(tilt.getSignalSource()).toBe('orientation');
      now = 2000;
      tilt.update(16);
      expect(tilt.getSignalSource()).toBeNull();
      expect(tilt.getSteering()).toBe(0);
    } finally {
      tilt.disable();
      clock.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});

describe('iOS screen axes', () => {
  it('prefers the physical legacy orientation on permission-based devices', () => {
    expect(resolveScreenAngle(90, -90, true)).toBe(270);
    expect(resolveScreenAngle(0, 90, true)).toBe(90);
    expect(resolveScreenAngle(90, -90, false)).toBe(90);
    expect(resolveScreenAngle(undefined, -90, false)).toBe(270);
  });

  it('corrects a quarter-turn or reversed axis only at neutral', () => {
    expect(calibratedScreenAngle(-1, 0, 0)).toBe(90);
    expect(calibratedScreenAngle(1, 0, 90)).toBe(270);
    expect(calibratedScreenAngle(0, -1, 90)).toBe(0);
    expect(calibratedScreenAngle(-0.2, 0, 0)).toBe(0);
    expect(calibratedScreenAngle(-0.9, -0.3, 90)).toBe(90);
  });

  it.each([0, 90, 270])('pitch is neutral and wheel rotation is steering at screen angle %i', (angle) => {
    const a = angle * Math.PI / 180;
    const toDevice = (sx: number, sy: number) => ({ gx: sx * Math.cos(a) + sy * Math.sin(a), gy: -sx * Math.sin(a) + sy * Math.cos(a) });
    for (const down of [0.3, 0.7, 1]) {
      const g = toDevice(0, -down);
      expect(tiltFromGravity(g.gx, g.gy, angle)).toBeCloseTo(0);
    }
    const right = toDevice(Math.sin(Math.PI / 6), -Math.cos(Math.PI / 6));
    const left = toDevice(-Math.sin(Math.PI / 6), -Math.cos(Math.PI / 6));
    expect(tiltFromGravity(right.gx, right.gy, angle)).toBeCloseTo(30);
    expect(tiltFromGravity(left.gx, left.gy, angle)).toBeCloseTo(-30);
  });
});
