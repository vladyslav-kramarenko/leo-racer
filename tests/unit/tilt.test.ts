import { describe, expect, it } from 'vitest';
import { angleDiff, gravityFromEuler, tiltAngleDeg, tiltToSteering, toScreen } from '../../src/input/TiltInput';
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
