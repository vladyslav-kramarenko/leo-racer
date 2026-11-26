import { describe, expect, it, vi } from 'vitest';
import { KeyboardInput, KeyboardSteering } from '../../src/input/KeyboardInput';

const timing = { rampUpMs: 400, returnMs: 300 };

it('uses separate Shift keys for gears once per press and resets held keys on blur', () => {
  // A DOM-like event target is sufficient to exercise the actual event handlers.
  vi.stubGlobal('HTMLElement', class {});
  const target = new EventTarget();
  const input = new KeyboardInput();
  const shift = vi.fn();
  input.onShift(shift);
  const detach = input.attach(target as unknown as Window);
  const key = (type: string, code: string, repeat = false) => {
    target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { code, repeat }));
  };
  try {
    key('keydown', 'ShiftRight');
    key('keydown', 'ShiftRight', true);
    key('keydown', 'ShiftRight');
    key('keyup', 'ShiftRight');
    key('keydown', 'ShiftLeft');
    target.dispatchEvent(new Event('blur'));
    key('keydown', 'ShiftLeft');
    expect(shift.mock.calls).toEqual([[1], [-1], [-1]]);
    detach();
    key('keydown', 'ShiftRight');
    expect(shift).toHaveBeenCalledTimes(3);
  } finally {
    detach();
    vi.unstubAllGlobals();
  }
});

function run(k: KeyboardSteering, ms: number, step = 16): void {
  for (let t = 0; t < ms; t += step) k.update(Math.min(step, ms - t));
}

describe('keyboard steering smoothing', () => {
  it('does not jump to full lock instantly', () => {
    const k = new KeyboardSteering(timing);
    k.setKeys(false, true);
    k.update(16);
    expect(k.getSteering()).toBeGreaterThan(0);
    expect(k.getSteering()).toBeLessThan(0.1);
  });

  it('ramps up gradually and reaches full lock in ~rampUpMs', () => {
    const k = new KeyboardSteering(timing);
    k.setKeys(false, true);
    run(k, 200);
    expect(k.getSteering()).toBeCloseTo(0.5, 1);
    run(k, 200);
    expect(k.getSteering()).toBeCloseTo(1, 5);
    run(k, 1000);
    expect(k.getSteering()).toBe(1);
  });

  it('steers left with negative values', () => {
    const k = new KeyboardSteering(timing);
    k.setKeys(true, false);
    run(k, 500);
    expect(k.getSteering()).toBe(-1);
  });

  it('returns to centre in ~returnMs after release', () => {
    const k = new KeyboardSteering(timing);
    k.setKeys(false, true);
    run(k, 500);
    k.setKeys(false, false);
    run(k, 150);
    expect(k.getSteering()).toBeCloseTo(0.5, 1);
    run(k, 160);
    expect(k.getSteering()).toBe(0);
  });

  it('cancels out when left and right are pressed together', () => {
    const k = new KeyboardSteering(timing);
    k.setKeys(true, true);
    run(k, 500);
    expect(k.getSteering()).toBe(0);
    expect(k.isHeld()).toBe(false);
  });

  it('is monotonic while holding', () => {
    const k = new KeyboardSteering(timing);
    k.setKeys(false, true);
    let prev = 0;
    for (let i = 0; i < 40; i++) {
      k.update(16);
      expect(k.getSteering()).toBeGreaterThanOrEqual(prev);
      prev = k.getSteering();
    }
  });
});
