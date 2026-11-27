import { describe, expect, it } from 'vitest';
import { getPreset, listPresets } from '../../src/world/presets';
import { WeatherCycle } from '../../src/world/WeatherCycle';
import { rainbowGeometry } from '../../src/world/NatureWeather';

describe('Nature weather', () => {
  const preset = getPreset('nature').weather!;
  it('is enabled only in Nature', () => {
    expect(listPresets().filter(p => p.weather).map(p => p.id)).toEqual(['nature']);
  });
  it('starts clear, fades rain in and out, then shows the first rainbow', () => {
    const c = new WeatherCycle(preset, () => 0);
    expect(c.update(14)).toEqual({ phase: 'clear', rain: 0, rainbow: 0 });
    expect(c.update(1)).toEqual({ phase: 'rain', rain: 0, rainbow: 0 });
    expect(c.update(1).rain).toBeCloseTo(0.5);
    expect(c.update(0).rain).toBeCloseTo(0.5);
    expect(c.update(1).rain).toBe(1);
    expect(c.update(7).rain).toBeCloseTo(0.5);
    expect(c.update(1).phase).toBe('rainbow');
    expect(c.update(2).rainbow).toBe(1);
    expect(c.update(14).phase).toBe('clear');
    expect(c.update(59).phase).toBe('clear');
    expect(c.update(1).phase).toBe('rain');
  });
  it('later rain need not produce a rainbow; reset returns to clear', () => {
    const c = new WeatherCycle(preset, () => 0.99);
    c.update(15 + 14 + 16 + 120);
    expect(c.update(14).phase).toBe('clear');
    c.reset();
    expect(c.update(0)).toEqual({ phase: 'clear', rain: 0, rainbow: 0 });
  });
  it('builds one compact seven-band rainbow', () => {
    const g = rainbowGeometry();
    try {
      const pos = g.getAttribute('position');
      expect(pos.count / 3).toBe(7 * 40 * 2);
      expect(g.getAttribute('color').count).toBe(pos.count);
      expect(Array.from(pos.array).every(Number.isFinite)).toBe(true);
      g.computeBoundingBox();
      expect(g.boundingBox!.max.y).toBeCloseTo(36);
    } finally { g.dispose(); }
  });
});
