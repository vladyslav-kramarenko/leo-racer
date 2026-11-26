import { describe, expect, it, vi } from 'vitest';
import { GamepadInput } from '../../src/input/GamepadInput';
import { HapticFeedback, roadEdgeStrength, type HapticActuator } from '../../src/input/HapticFeedback';
import { CONFIG } from '../../src/game/config';

function actuator() {
  return {
    effects: ['dual-rumble'] as const,
    playEffect: vi.fn().mockResolvedValue('complete'),
    reset: vi.fn().mockResolvedValue('complete'),
  };
}

describe('haptic feedback', () => {
  it('sends a short impact once per cooldown and suppresses road pulses during it', () => {
    const motor = actuator();
    const haptics = new HapticFeedback(() => motor);
    haptics.roadEdge(0, 1);
    haptics.impact(10);
    haptics.impact(100);
    haptics.roadEdge(200, 1);
    expect(motor.playEffect).toHaveBeenCalledTimes(2);
    expect(motor.playEffect).toHaveBeenLastCalledWith('dual-rumble', {
      duration: 180, startDelay: 0, strongMagnitude: 0.35, weakMagnitude: 0.55,
    });
    haptics.impact(310);
    expect(motor.playEffect).toHaveBeenCalledTimes(3);
  });

  it('limits roadside impulses and increases strength towards the hard boundary', () => {
    const motor = actuator();
    const haptics = new HapticFeedback(() => motor);
    haptics.roadEdge(0, 0.25);
    haptics.roadEdge(100, 1);
    haptics.roadEdge(350, 1);
    expect(motor.playEffect).toHaveBeenCalledTimes(2);
    const first = motor.playEffect.mock.calls[0][1] as GamepadEffectParameters;
    const last = motor.playEffect.mock.calls[1][1] as GamepadEffectParameters;
    expect(last.strongMagnitude).toBeGreaterThan(first.strongMagnitude!);
    expect(last.weakMagnitude).toBeLessThanOrEqual(0.3);
  });

  it('ignores missing hardware and unsupported effects', () => {
    const haptics = new HapticFeedback(() => null);
    expect(haptics.getStatus()).toBe('unsupported');
    expect(() => { haptics.impact(0); haptics.stop(); }).not.toThrow();
    const motor = { ...actuator(), effects: ['trigger-rumble'] as const };
    new HapticFeedback(() => motor).impact(0);
    expect(motor.playEffect).not.toHaveBeenCalled();
  });

  it('handles rejected effects and reset errors without interrupting the game', async () => {
    const motor = actuator();
    motor.playEffect.mockRejectedValue(new Error('unsupported'));
    motor.reset.mockRejectedValue(new Error('disconnected'));
    const haptics = new HapticFeedback(() => motor);
    haptics.impact(0);
    await Promise.resolve();
    expect(haptics.getStatus()).toBe('unavailable');
    haptics.impact(500);
    expect(motor.playEffect).toHaveBeenCalledTimes(1);
    haptics.stop();
    await Promise.resolve();
  });

  it('stops on focus loss and blocks further effects until focus returns', () => {
    const motor = actuator();
    const target = new EventTarget();
    const doc = Object.assign(new EventTarget(), { hidden: false, hasFocus: () => true });
    const haptics = new HapticFeedback(() => motor);
    const detach = haptics.attach(target as Window, doc as unknown as Document);
    haptics.impact(0);
    target.dispatchEvent(new Event('blur'));
    expect(motor.reset).toHaveBeenCalledTimes(1);
    haptics.impact(500);
    expect(motor.playEffect).toHaveBeenCalledTimes(1);
    target.dispatchEvent(new Event('focus'));
    haptics.impact(600);
    expect(motor.playEffect).toHaveBeenCalledTimes(2);
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    haptics.impact(1000);
    expect(motor.playEffect).toHaveBeenCalledTimes(2);
    detach();
    target.dispatchEvent(new Event('focus'));
    haptics.impact(1500);
    expect(motor.playEffect).toHaveBeenCalledTimes(2);
  });

  it('uses the calibrated device and stops its motor on disconnect', () => {
    const wrongMotor = actuator();
    const rightMotor = actuator();
    const pad = (id: string, index: number, vibrationActuator: HapticActuator) => ({
      id, index, connected: true, axes: [0], buttons: [], vibrationActuator,
    }) as unknown as Gamepad;
    let pads = [pad('Other', 0, wrongMotor), pad('Wheel', 1, rightMotor)];
    const input = new GamepadInput(() => pads);
    input.setCalibration({ gamepadId: 'Wheel', steeringAxis: 0, min: -1, center: 0, max: 1, deadzone: 0.04, invertAxis: false });
    input.update();
    input.haptics.impact(0);
    expect(rightMotor.playEffect).toHaveBeenCalledTimes(1);
    expect(wrongMotor.playEffect).not.toHaveBeenCalled();
    pads = [];
    input.update();
    expect(rightMotor.reset).toHaveBeenCalledTimes(1);
    expect(input.haptics.getStatus()).toBe('unsupported');
  });
});

describe('road edge detection', () => {
  it('reacts on both edges only to outward steering while moving', () => {
    const { softLimit, hardLimit } = CONFIG.driving;
    expect(roadEdgeStrength(softLimit, 1, 8)).toBe(0.25);
    expect(roadEdgeStrength(hardLimit, 1, 8)).toBe(1);
    expect(roadEdgeStrength(-hardLimit, -1, 8)).toBe(1);
    expect(roadEdgeStrength(hardLimit, -1, 8)).toBe(0);
    expect(roadEdgeStrength(hardLimit, 0, 8)).toBe(0);
    expect(roadEdgeStrength(0, 1, 8)).toBe(0);
    expect(roadEdgeStrength(hardLimit, 1, 0)).toBe(0);
    expect(roadEdgeStrength(NaN, 1, 8)).toBe(0);
  });
});
