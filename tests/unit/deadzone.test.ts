import { describe, expect, it } from 'vitest';
import { CalibrationRecorder, GamepadInput } from '../../src/input/GamepadInput';
import { applyDeadzone, normalizeAxis, normalizePedal, pedalSpeedMultiplier } from '../../src/input/SteeringState';
import { InputManager } from '../../src/input/InputManager';
import { vi } from 'vitest';

const cal = { min: -1, center: 0, max: 1, invertAxis: false, deadzone: 0.04 };

describe('deadzone', () => {
  it('ignores small jitter', () => {
    expect(applyDeadzone(0.03, 0.04)).toBe(0);
    expect(applyDeadzone(-0.039, 0.04)).toBe(0);
  });

  it('rescales smoothly outside the deadzone', () => {
    expect(applyDeadzone(0.05, 0.04)).toBeGreaterThan(0);
    expect(applyDeadzone(0.05, 0.04)).toBeLessThan(0.02);
    expect(applyDeadzone(1, 0.04)).toBe(1);
    expect(applyDeadzone(-1, 0.04)).toBe(-1);
  });
});

describe('axis normalisation', () => {
  it('maps calibrated min/center/max to -1/0/+1', () => {
    const c = { min: -0.8, center: 0.1, max: 0.9, invertAxis: false, deadzone: 0 };
    expect(normalizeAxis(-0.8, c)).toBeCloseTo(-1);
    expect(normalizeAxis(0.1, c)).toBeCloseTo(0);
    expect(normalizeAxis(0.9, c)).toBeCloseTo(1);
    expect(normalizeAxis(0.5, c)).toBeCloseTo(0.5);
  });

  it('clamps beyond calibrated range and handles NaN', () => {
    expect(normalizeAxis(5, cal)).toBe(1);
    expect(normalizeAxis(-5, cal)).toBe(-1);
    expect(normalizeAxis(Number.NaN, cal)).toBe(0);
  });

  it('inverts when configured', () => {
    expect(normalizeAxis(1, { ...cal, invertAxis: true })).toBe(-1);
  });
});

describe('calibration', () => {
  it('selects the axis with the largest movement range', () => {
    const rec = new CalibrationRecorder('Logitech MOMO Racing');
    // Axis 0 jitters, axis 1 is the wheel, axis 2 is a pedal barely touched.
    for (let t = 0; t < 100; t++) {
      const wheel = Math.sin(t / 8);
      rec.sample([0.01 * Math.sin(t), wheel, 0.1 * (t % 3)]);
    }
    const built = rec.build(0.04)!;
    expect(built.steeringAxis).toBe(1);
    expect(built.min).toBeLessThan(-0.9);
    expect(built.max).toBeGreaterThan(0.9);
    expect(built.center).toBeCloseTo((built.min + built.max) / 2);
    expect(built.gamepadId).toBe('Logitech MOMO Racing');
  });

  it('refuses a calibration with too little movement', () => {
    const rec = new CalibrationRecorder('pad');
    rec.sample([0, 0]);
    rec.sample([0.05, 0.02]);
    expect(rec.build()).toBeNull();
  });
});

describe('gamepad input', () => {
  const pad = (axes: number[], buttons: boolean[] = [false]) =>
    ({
      id: 'Test Wheel',
      index: 0,
      connected: true,
      axes,
      buttons: buttons.map((pressed) => ({ pressed, touched: pressed, value: pressed ? 1 : 0 })),
    }) as unknown as Gamepad;

  it('uses axis 0 before calibration', () => {
    let current = pad([0.5, -1]);
    const input = new GamepadInput(() => [current]);
    input.update();
    expect(input.getSteering()).toBeGreaterThan(0.4);
    current = pad([0.02, -1]);
    input.update();
    expect(input.getSteering()).toBe(0);
  });

  it('brakes with an inverted pedal axis and releases on disconnect', () => {
    let pads: (Gamepad | null)[] = [pad([0, 1])];
    const input = new GamepadInput(() => pads);
    input.setCalibration({ gamepadId: 'Test Wheel', steeringAxis: 0, ...cal,
      brake: { axis: 1, released: 1, pressed: -1 } });
    input.update();
    expect(input.isBraking()).toBe(false);
    pads = [pad([0, -1])];
    input.update();
    expect(input.getBrake()).toBe(1);
    expect(input.isBraking()).toBe(true);
    pads = [pad([0, 1])];
    input.update();
    expect(input.isBraking()).toBe(false);
    pads = [pad([0, -1])];
    input.update();
    pads = [null];
    input.update();
    expect(input.isBraking()).toBe(false);
  });

  it('ignores missing pedal axes and calibration for a different wheel', () => {
    const input = new GamepadInput(() => [pad([0])]);
    input.setCalibration({ gamepadId: 'Test Wheel', steeringAxis: 0, ...cal,
      brake: { axis: 1, released: 1, pressed: -1 } });
    input.update();
    expect(input.isBraking()).toBe(false);
    input.setCalibration({ gamepadId: 'Other Wheel', steeringAxis: 0, ...cal,
      brake: { axis: 0, released: 1, pressed: -1 } });
    input.update();
    expect(input.isBraking()).toBe(false);
  });

  it('reads separate accelerator pedals and clears acceleration on disconnect', () => {
    let pads: (Gamepad | null)[] = [pad([0, 1, 1])];
    const input = new GamepadInput(() => pads);
    input.setCalibration({ gamepadId: 'Test Wheel', steeringAxis: 0, ...cal,
      brake: { axis: 1, released: 1, pressed: -1 },
      throttle: { axis: 2, released: 1, pressed: -1 } });
    input.update();
    expect(input.isAccelerating()).toBe(false);
    pads = [pad([0, 1, -1])];
    input.update();
    expect(input.isAccelerating()).toBe(true);
    expect(input.isBraking()).toBe(false);
    pads = [null];
    input.update();
    expect(input.isAccelerating()).toBe(false);
    expect(input.getThrottle()).toBe(0);
  });

  it('distinguishes gas and brake on a shared axis through the input manager', () => {
    const manager = new InputManager();
    let axes = [0, 0];
    vi.spyOn(manager.gamepad, 'snapshots').mockImplementation(() => [
      { id: 'Test Wheel', index: 0, axes, buttons: [] },
    ]);
    manager.setCalibration({ gamepadId: 'Test Wheel', steeringAxis: 0, ...cal,
      brake: { axis: 1, released: 0, pressed: -1 },
      throttle: { axis: 1, released: 0, pressed: 1 } });
    manager.update(16);
    expect(manager.isAccelerating()).toBe(false);
    axes = [0, 1];
    manager.update(16);
    expect(manager.isAccelerating()).toBe(true);
    expect(manager.isBraking()).toBe(false);
    axes = [0, -1];
    manager.update(16);
    expect(manager.isAccelerating()).toBe(false);
    expect(manager.isBraking()).toBe(true);
    axes = [0, 0];
    manager.update(16);
    expect(manager.isAccelerating()).toBe(false);
    expect(manager.isBraking()).toBe(false);
  });

  it('passes pedal braking through the input manager without stealing steering', () => {
    const manager = new InputManager();
    let axes = [0, 1];
    vi.spyOn(manager.gamepad, 'snapshots').mockImplementation(() => [
      { id: 'Test Wheel', index: 0, axes, buttons: [] },
    ]);
    manager.setCalibration({ gamepadId: 'Test Wheel', steeringAxis: 0, ...cal,
      brake: { axis: 1, released: 1, pressed: -1 } });
    manager.update(16);
    manager.keyboard.steering.setKeys(false, true);
    manager.update(16);
    expect(manager.getSource()).toBe('keyboard');
    axes = [0, -1];
    manager.update(16);
    expect(manager.isBraking()).toBe(true);
    expect(manager.isHeldActive()).toBe(true);
    expect(manager.getSource()).toBe('keyboard');
    expect(manager.getUsedSources()).toContain('gamepad');
    axes = [0, 1];
    manager.update(16);
    expect(manager.isBraking()).toBe(false);
  });

  it('uses the calibrated axis and inversion', () => {
    const input = new GamepadInput(() => [pad([0, 0.8])]);
    input.setCalibration({ gamepadId: 'Test Wheel', steeringAxis: 1, invertAxis: true, min: -1, center: 0, max: 1, deadzone: 0.04 });
    input.update();
    expect(input.getSteering()).toBeLessThan(-0.7);
  });

  it('survives disconnects', () => {
    let pads: (Gamepad | null)[] = [pad([1])];
    const input = new GamepadInput(() => pads);
    input.update();
    pads = [null];
    input.update();
    expect(input.getSteering()).toBe(0);
    expect(input.getConnected()).toBeNull();
    pads = [pad([-1])];
    input.update();
    expect(input.getSteering()).toBe(-1);
  });

  it('honks on a button press edge only', () => {
    let buttons = [false];
    const input = new GamepadInput(() => [pad([0], buttons)]);
    let honks = 0;
    input.onHorn(() => honks++);
    input.update();
    buttons = [true];
    input.update();
    input.update();
    buttons = [false];
    input.update();
    expect(honks).toBe(1);
  });
});

describe('pedal normalisation', () => {
  it('maps active pedal travel linearly from 1.5× to 3× and ignores rest jitter', () => {
    expect(pedalSpeedMultiplier(0)).toBe(1);
    expect(pedalSpeedMultiplier(0.1)).toBe(1);
    expect(pedalSpeedMultiplier(0.100001)).toBeCloseTo(1.5, 4);
    expect(pedalSpeedMultiplier(0.55)).toBeCloseTo(2.25);
    expect(pedalSpeedMultiplier(1)).toBe(3);
    expect(pedalSpeedMultiplier(5)).toBe(3);
    expect(pedalSpeedMultiplier(NaN)).toBe(1);
  });

  it('keyboard always overrides partial pedal travel with 3× until release', () => {
    const manager = new InputManager();
    vi.spyOn(manager.gamepad, 'getThrottle').mockReturnValue(0.55);
    const key = vi.spyOn(manager.keyboard, 'isAccelerating').mockReturnValue(false);
    expect(manager.getSpeedMultiplier()).toBeCloseTo(2.25);
    key.mockReturnValue(true);
    expect(manager.getSpeedMultiplier()).toBe(3);
    key.mockReturnValue(false);
    expect(manager.getSpeedMultiplier()).toBeCloseTo(2.25);
    vi.spyOn(manager.gamepad, 'getThrottle').mockReturnValue(0);
    expect(manager.getSpeedMultiplier()).toBe(1);
  });
  it('handles combined pedals without treating the accelerator as a brake', () => {
    const brake = { axis: 2, released: 0, pressed: -1 };
    expect(normalizePedal(0, brake)).toBe(0);
    expect(normalizePedal(1, brake)).toBe(0);
    expect(normalizePedal(-0.5, brake)).toBe(0.5);
    expect(normalizePedal(-1, brake)).toBe(1);
  });

  it('supports increasing axes and rejects invalid readings', () => {
    const brake = { axis: 1, released: -1, pressed: 1 };
    expect(normalizePedal(-1, brake)).toBe(0);
    expect(normalizePedal(1, brake)).toBe(1);
    expect(normalizePedal(NaN, brake)).toBe(0);
    expect(normalizePedal(1, { ...brake, pressed: -1 })).toBe(0);
  });
});
