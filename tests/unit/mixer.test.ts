import { describe, expect, it } from 'vitest';
import { SteeringMixer } from '../../src/driving/SteeringMixer';

const opts = { idleTimeoutMs: 8000, activityThreshold: 0.03, blendMs: 1000 };

/** Advance the mixer with constant inputs; returns the final output. */
function hold(m: SteeringMixer, manual: number, auto: number, fromMs: number, durationMs: number, step = 16): number {
  let out = 0;
  for (let t = fromMs; t < fromMs + durationMs; t += step) out = m.update(manual, auto, t, step);
  return out;
}

describe('SteeringMixer', () => {
  it('starts in autopilot', () => {
    const m = new SteeringMixer(opts);
    expect(m.update(0, 0.3, 0, 16)).toBeCloseTo(0.3);
    expect(m.getMode()).toBe('autopilot');
  });

  describe('manual activity detection', () => {
    it('switches to manual immediately on meaningful input', () => {
      const m = new SteeringMixer(opts);
      m.update(0, 0.3, 0, 16);
      const out = m.update(0.2, 0.3, 16, 16);
      expect(m.getMode()).toBe('manual');
      // Instant takeover — no blend delay.
      expect(out).toBeCloseTo(0.2);
    });

    it('ignores jitter below the threshold', () => {
      const m = new SteeringMixer(opts);
      let t = 0;
      for (let i = 0; i < 600; i++, t += 16) {
        const jitter = (i % 2 ? 1 : -1) * 0.012;
        m.update(jitter, 0.1, t, 16);
      }
      expect(m.getMode()).toBe('autopilot');
    });

    it('treats a held key as activity even when the value is constant', () => {
      const m = new SteeringMixer(opts);
      let t = 0;
      for (let i = 0; i < 1000; i++, t += 16) m.update(1, 0, t, 16, true);
      expect(m.getMode()).toBe('manual');
    });
  });

  describe('8-second idle timeout', () => {
    it('stays manual before the timeout and returns to autopilot after it', () => {
      const m = new SteeringMixer(opts);
      m.update(0, 0, 0, 16);
      m.update(0.5, 0, 16, 16);
      expect(m.getMode()).toBe('manual');
      hold(m, 0.5, 0, 32, 7900);
      expect(m.getMode()).toBe('manual');
      hold(m, 0.5, 0, 7932, 200);
      expect(m.getMode()).toBe('autopilot');
    });

    it('a wheel held still (constant value) hands back to autopilot', () => {
      const m = new SteeringMixer(opts);
      m.update(0, 0, 0, 16);
      m.update(1, 0, 16, 16);
      hold(m, 1, 0, 32, 8100);
      expect(m.getMode()).toBe('autopilot');
    });

    it('new input during autopilot immediately returns control', () => {
      const m = new SteeringMixer(opts);
      m.update(0, 0, 0, 16);
      m.update(0.5, 0, 16, 16);
      hold(m, 0.5, 0, 32, 9500);
      expect(m.getMode()).toBe('autopilot');
      const out = m.update(-0.4, 0.2, 9600, 16);
      expect(m.getMode()).toBe('manual');
      expect(out).toBeCloseTo(-0.4);
    });
  });

  describe('manual/autopilot blending', () => {
    it('blends back to autopilot over ~1 second', () => {
      const m = new SteeringMixer(opts);
      m.update(0, 0, 0, 16);
      m.update(1, 0, 16, 16);
      hold(m, 1, 0, 32, 8000); // reaches the timeout
      expect(m.getMode()).toBe('autopilot');
      const w0 = m.getManualWeight();
      expect(w0).toBeGreaterThan(0.9);

      const mid = hold(m, 1, -1, 8032, 500);
      expect(mid).toBeGreaterThan(-0.3);
      expect(mid).toBeLessThan(0.3);
      expect(m.getManualWeight()).toBeCloseTo(0.5, 1);

      const end = hold(m, 1, -1, 8532, 600);
      expect(m.getManualWeight()).toBe(0);
      expect(end).toBeCloseTo(-1);
    });

    it('output is always within -1..1', () => {
      const m = new SteeringMixer(opts);
      for (let t = 0; t < 20000; t += 16) {
        const out = m.update(Math.sin(t / 300) * 1.5, Math.cos(t / 700) * 1.5, t, 16);
        expect(Math.abs(out)).toBeLessThanOrEqual(1);
      }
    });
  });
});
