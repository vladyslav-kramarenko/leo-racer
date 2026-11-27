import { describe, expect, it } from 'vitest';
import { createCubRoar, createTrainChuff, createTrainWhistle, createSantaLaugh, createSantaMagic, createSantaGreeting, distanceGain, santaGreetingGain, shouldGreetSanta,
  CUB_ROAR_SECONDS, TRAIN_CHUFF_SECONDS, TRAIN_WHISTLE_SECONDS, SANTA_LAUGH_SECONDS, SANTA_MAGIC_SECONDS, SANTA_GREETING_SECONDS } from '../../src/audio/characterSounds';

describe('procedural character sounds', () => {
  it.each([
    [createCubRoar, CUB_ROAR_SECONDS], [createTrainChuff, TRAIN_CHUFF_SECONDS],
    [createTrainWhistle, TRAIN_WHISTLE_SECONDS], [createSantaLaugh, SANTA_LAUGH_SECONDS],
    [createSantaMagic, SANTA_MAGIC_SECONDS], [createSantaGreeting, SANTA_GREETING_SECONDS],
  ] as const)('produces a bounded, audible buffer (%s)', (generate, seconds) => {
    for (const rate of [24000, 44100, 48000]) {
      const buffer = generate(rate);
      expect(buffer.length).toBe(Math.round(rate * seconds));
      let peak = 0, sum = 0;
      expect(buffer.every(Number.isFinite)).toBe(true);
      for (const v of buffer) {
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      expect(peak).toBeLessThanOrEqual(0.8);
      expect(Math.sqrt(sum / buffer.length)).toBeGreaterThan(0.01);
      expect(Math.abs(buffer[0])).toBeLessThan(0.01);
      expect(Math.abs(buffer[buffer.length - 1])).toBeLessThan(0.01);
    }
  });
  it('makes Santa audible at the normal sky-crossing distance and delays the greeting', () => {
    expect(santaGreetingGain(120)).toBeCloseTo(0.85);
    expect(santaGreetingGain(145)).toBeCloseTo(0.85);
    expect(santaGreetingGain(200)).toBeGreaterThan(0.2);
    expect(santaGreetingGain(Infinity)).toBe(0);
    expect(shouldGreetSanta(145, 0.1)).toBe(false);
    expect(shouldGreetSanta(145, 0.4)).toBe(true);
    expect(shouldGreetSanta(220, 0.5)).toBe(false);
    expect(shouldGreetSanta(100, null)).toBe(false);
  });
  it('plays the wand flourish before the laugh with no overlap', () => {
    const rate = 24000;
    const greeting = createSantaGreeting(rate);
    const magic = createSantaMagic(rate);
    const laugh = createSantaLaugh(rate);
    expect(greeting.slice(0, magic.length)).toEqual(magic);
    expect(greeting.slice(magic.length)).toEqual(laugh);
  });
  it('fades smoothly by distance and is silent outside range', () => {
    expect(distanceGain(0, 12, 115)).toBe(1);
    expect(distanceGain(63.5, 12, 115)).toBeCloseTo(0.5);
    expect(distanceGain(115, 12, 115)).toBe(0);
    expect(distanceGain(Infinity, 12, 115)).toBe(0);
  });
});
