import { describe, expect, it } from 'vitest';
import { Autopilot } from '../../src/driving/Autopilot';
import { VehicleController } from '../../src/driving/VehicleController';
import { CONFIG } from '../../src/game/config';

const { hardLimit, softLimit, speed } = CONFIG.driving;

function drive(v: VehicleController, seconds: number, steering: (t: number) => number, dt = 1 / 60): number {
  let maxAbs = 0;
  for (let t = 0; t < seconds; t += dt) {
    const s = v.update(dt, steering(t));
    maxAbs = Math.max(maxAbs, Math.abs(s.lateralOffset));
    expect(Number.isFinite(s.lateralOffset)).toBe(true);
  }
  return maxAbs;
}

describe('lane limits (impossible to fail)', () => {
  it('holding full right for one minute never exceeds the hard boundary', () => {
    const v = new VehicleController();
    const maxAbs = drive(v, 60, () => 1);
    expect(maxAbs).toBeLessThanOrEqual(hardLimit + 1e-9);
    expect(v.state.lateralOffset).toBeGreaterThan(softLimit * 0.9);
  });

  it('holding full left for one minute never exceeds the hard boundary', () => {
    const v = new VehicleController();
    expect(drive(v, 60, () => -1)).toBeLessThanOrEqual(hardLimit + 1e-9);
  });

  it('keeps moving forward at constant speed no matter what', () => {
    const v = new VehicleController();
    drive(v, 30, (t) => (Math.floor(t * 3) % 2 ? 1 : -1));
    expect(v.state.speed).toBe(speed);
    expect(v.state.progress).toBeCloseTo(30 * speed, 0);
  });

  it('frantic left-right steering stays inside the corridor', () => {
    const v = new VehicleController();
    expect(drive(v, 60, (t) => Math.sign(Math.sin(t * 17)))).toBeLessThanOrEqual(hardLimit + 1e-9);
  });

  it('steering matters: the vehicle does move sideways', () => {
    const v = new VehicleController();
    drive(v, 1, () => 1);
    expect(v.state.lateralOffset).toBeGreaterThan(1.5);
  });

  it('drifts back from the boundary after release', () => {
    const v = new VehicleController();
    drive(v, 10, () => 1);
    drive(v, 3, () => 0);
    expect(v.state.lateralOffset).toBeLessThanOrEqual(softLimit + 0.05);
  });

  it('ignores garbage input and huge frame times', () => {
    const v = new VehicleController();
    v.update(Number.NaN, Number.NaN);
    v.update(1000, 50);
    v.update(-5, -50);
    expect(Math.abs(v.state.lateralOffset)).toBeLessThanOrEqual(hardLimit);
    expect(Number.isFinite(v.state.progress)).toBe(true);
    expect(Math.abs(v.state.yaw)).toBeLessThanOrEqual(CONFIG.driving.maxYaw);
  });
});

describe('autopilot', () => {
  it('keeps the vehicle near the centre with gentle variation', () => {
    const v = new VehicleController();
    const ap = new Autopilot(CONFIG.autopilot, 1);
    let maxAbs = 0;
    let maxSteerDelta = 0;
    let prev: number | null = null;
    for (let t = 0; t < 120; t += 1 / 60) {
      const steer = ap.getSteering({
        timeSec: t,
        dtSec: 1 / 60,
        lateralOffset: v.state.lateralOffset,
        lateralVelocity: v.state.lateralVelocity,
        curvatureAhead: 0,
      });
      if (prev !== null) maxSteerDelta = Math.max(maxSteerDelta, Math.abs(steer - prev));
      prev = steer;
      v.update(1 / 60, steer);
      if (t > 3) maxAbs = Math.max(maxAbs, Math.abs(v.state.lateralOffset));
    }
    expect(maxAbs).toBeLessThan(softLimit);
    expect(maxAbs).toBeGreaterThan(0.2); // not perfectly robotic
    expect(maxSteerDelta).toBeLessThan(0.05); // no abrupt steering
  });

  it('recovers from the boundary', () => {
    const v = new VehicleController();
    drive(v, 5, () => -1);
    const ap = new Autopilot(CONFIG.autopilot, 1);
    for (let t = 0; t < 8; t += 1 / 60) {
      v.update(1 / 60, ap.getSteering({ timeSec: t, dtSec: 1 / 60, lateralOffset: v.state.lateralOffset, lateralVelocity: v.state.lateralVelocity, curvatureAhead: 0 }));
    }
    expect(Math.abs(v.state.lateralOffset)).toBeLessThan(1.5);
  });
});
