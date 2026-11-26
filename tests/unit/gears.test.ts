import { describe, expect, it, vi } from 'vitest';
import { GEARS, Gearbox } from '../../src/driving/Gearbox';
import { VehicleController } from '../../src/driving/VehicleController';
import { CONFIG } from '../../src/game/config';
import { GamepadInput } from '../../src/input/GamepadInput';

describe('gear ratios', () => {
  it('starts in the original cruise gear and clamps gear changes at both ends', () => {
    const gearbox = new Gearbox();
    expect(gearbox.getGear()).toBe(3);
    expect(gearbox.getRatios()).toEqual({ speed: 1, rpm: 1 });
    for (let i = 0; i < 10; i++) gearbox.shift(1);
    expect(gearbox.getGear()).toBe(5);
    for (let i = 0; i < 10; i++) gearbox.shift(-1);
    expect(gearbox.getGear()).toBe(1);
    gearbox.reset();
    expect(gearbox.getGear()).toBe(3);
  });

  it('raising gear increases base speed and lowers the engine tone', () => {
    for (let i = 1; i < GEARS.length; i++) {
      expect(GEARS[i].speed).toBeGreaterThan(GEARS[i - 1].speed);
      expect(GEARS[i].rpm).toBeLessThan(GEARS[i - 1].rpm);
    }
  });

  it('smoothly changes cruise speed and applies gas on top of the selected gear', () => {
    const vehicle = new VehicleController();
    const run = (braking = false, boost = 1) => {
      for (let i = 0; i < 1800; i++) vehicle.update(1 / 60, 0, braking, boost);
    };
    vehicle.gearbox.shift(1);
    vehicle.update(1 / 60, 0);
    expect(vehicle.state.speed).toBeGreaterThan(CONFIG.driving.speed);
    expect(vehicle.state.speed).toBeLessThan(vehicle.getCruisingSpeed());
    run();
    expect(vehicle.state.speed).toBe(CONFIG.driving.speed * 1.2);
    run(false, 3);
    expect(vehicle.state.speed).toBe(CONFIG.driving.speed * 1.2 * 3);
    run(true, 3);
    expect(vehicle.state.speed).toBe(0);
    vehicle.setCruiseScale(0);
    run(false, 3);
    expect(vehicle.state.speed).toBe(0);
  });
});

describe('wheel shift buttons', () => {
  it('assigns six distinct horns to non-gear buttons and ignores held buttons', () => {
    let buttons = Array<boolean>(10).fill(false);
    const input = new GamepadInput(() => [{ id: 'Wheel', index: 0, connected: true, axes: [0],
      buttons: buttons.map((pressed) => ({ pressed, value: Number(pressed), touched: pressed })),
    } as unknown as Gamepad]);
    input.setCalibration({ gamepadId: 'Wheel', steeringAxis: 0, min: -1, center: 0, max: 1,
      invertAxis: false, deadzone: 0.04, gearButtons: { up: 5, down: 4 }, secondaryGearButtons: { up: 8, down: 9 } });
    const horn = vi.fn();
    input.onHorn(horn);
    input.update();
    for (const button of [0, 1, 2, 3, 6, 7]) {
      buttons[button] = true;
      input.update(); input.update();
      buttons[button] = false;
      input.update();
    }
    expect(horn.mock.calls).toEqual([[0], [1], [2], [3], [4], [5]]);
    buttons = buttons.map((_, button) => [4, 5, 8, 9].includes(button));
    input.update();
    expect(horn).toHaveBeenCalledTimes(6);
  });

  it('accepts both sets, coalesces same-direction presses and reserves all four buttons', () => {
    const { input, shift, horn, set } = wheel();
    input.setCalibration({ gamepadId: 'Wheel', steeringAxis: 0, min: -1, center: 0, max: 1,
      deadzone: 0.04, invertAxis: false, gearButtons: { up: 5, down: 4 },
      secondaryGearButtons: { up: 2, down: 3 } });
    set(); set(5); set(); set(4); set(); set(2); set(2); set(); set(3);
    set(); set(5, 2); set(); set(4, 3); set(); set(5, 3); set(); set(2, 4);
    expect(shift.mock.calls).toEqual([[1], [-1], [1], [-1], [1], [-1]]);
    expect(horn).not.toHaveBeenCalled();
    set(); set(0);
    expect(horn).toHaveBeenCalledTimes(1);
    input.setCalibration({ ...input.getCalibration()!, secondaryGearButtons: null });
    set(); set(2);
    expect(shift).toHaveBeenCalledTimes(6);
    expect(horn).toHaveBeenCalledTimes(2);
  });

  function wheel() {
    let buttons = Array<boolean>(6).fill(false);
    const input = new GamepadInput(() => [{
      id: 'Wheel', index: 0, connected: true, axes: [0],
      buttons: buttons.map((pressed) => ({ pressed, value: Number(pressed), touched: pressed })),
    } as unknown as Gamepad]);
    const shift = vi.fn();
    const horn = vi.fn();
    input.onShift(shift);
    input.onHorn(horn);
    const set = (...indices: number[]) => {
      buttons = buttons.map((_, index) => indices.includes(index));
      input.update();
    };
    input.update();
    return { input, shift, horn, set };
  }

  it('shifts once per press, reserves shift buttons and leaves horn on other buttons', () => {
    const { shift, horn, set } = wheel();
    set(5); set(5); set(); set(4); set(4);
    expect(shift.mock.calls).toEqual([[1], [-1]]);
    expect(horn).not.toHaveBeenCalled();
    set(0);
    expect(horn).toHaveBeenCalledTimes(1);
  });

  it('uses saved button assignments and ignores simultaneous opposite shifts', () => {
    const { input, shift, horn, set } = wheel();
    input.setCalibration({ gamepadId: 'Wheel', steeringAxis: 0, min: -1, center: 0, max: 1,
      deadzone: 0.04, invertAxis: false, gearButtons: { up: 0, down: 1 } });
    set(0); // Held during calibration: baseline, no phantom shift.
    set(); set(0); set(); set(0, 1); set(); set(1);
    expect(shift.mock.calls).toEqual([[1], [-1]]);
    expect(horn).not.toHaveBeenCalled();
    set(5);
    expect(horn).toHaveBeenCalledTimes(1);
  });
});
