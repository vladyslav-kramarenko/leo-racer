import { describe, expect, it } from 'vitest';
import { SessionManager } from '../../src/session/SessionManager';

const MIN = 60_000;

function play(s: SessionManager, ms: number, active = true, step = 16): void {
  for (let t = 0; t < ms; t += step) s.tick(Math.min(step, ms - t), active);
}

describe('SessionManager', () => {
  it('stays idle until START', () => {
    const s = new SessionManager(10, 25_000);
    play(s, 20 * MIN);
    expect(s.phase).toBe('idle');
  });

  it('unlimited never ends', () => {
    const s = new SessionManager(null, 25_000);
    s.start();
    s.tick(10 * 60 * MIN, true);
    expect(s.phase).toBe('running');
    expect(s.remainingMs()).toBeNull();
  });

  it('10-minute mode enters the ending after ~10 active minutes', () => {
    const s = new SessionManager(10, 25_000);
    s.start();
    play(s, 10 * MIN - 1000, true, 1000);
    expect(s.phase).toBe('running');
    play(s, 2000, true, 1000);
    expect(s.phase).toBe('ending');
    expect(s.snapshot().finishReason).toBe('timeLimit');
  });

  it('Parent Menu (inactive) time does not consume play time', () => {
    const s = new SessionManager(5, 25_000);
    s.start();
    play(s, 4 * MIN, true, 1000);
    play(s, 30 * MIN, false, 1000);
    expect(s.phase).toBe('running');
    expect(s.remainingMs()).toBe(MIN);
  });

  it('the ending is gradual and finishes after its duration', () => {
    const s = new SessionManager(5, 25_000);
    s.start();
    s.tick(5 * MIN, true);
    expect(s.phase).toBe('ending');
    expect(s.endingProgress()).toBe(0);
    play(s, 12_500, true, 100);
    expect(s.endingProgress()).toBeCloseTo(0.5, 1);
    expect(s.phase).toBe('ending');
    play(s, 13_000, true, 100);
    expect(s.phase).toBe('finished');
    expect(s.endingProgress()).toBe(1);
  });

  it('finished cannot restart by itself — only via restart() (parent action)', () => {
    const s = new SessionManager(5, 1000);
    s.start();
    s.tick(5 * MIN, true);
    play(s, 2000);
    expect(s.phase).toBe('finished');
    s.start(); // a child pressing things must not matter
    play(s, 60 * MIN);
    expect(s.phase).toBe('finished');
    s.restart();
    expect(s.phase).toBe('running');
    expect(s.snapshot().elapsedActiveMs).toBe(0);
    expect(s.snapshot().finishReason).toBeNull();
  });

  it('changing the limit applies to the running session', () => {
    const s = new SessionManager(null, 25_000);
    s.start();
    play(s, 6 * MIN, true, 1000);
    s.setLimitMinutes(5);
    s.tick(16, true);
    expect(s.phase).toBe('ending');
  });
});
