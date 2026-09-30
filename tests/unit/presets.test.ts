import { describe, expect, it } from 'vitest';
import { DEFAULT_WORLD_ID, getPreset, listPresets, validatePreset } from '../../src/world/presets';
import { RoadGenerator } from '../../src/world/RoadGenerator';

describe('world preset loading', () => {
  it('loads the construction preset', () => {
    const preset = getPreset('construction');
    expect(preset.id).toBe('construction');
    expect(preset.name).toBe('Construction');
  });

  it('falls back to the default preset for unknown or missing ids', () => {
    expect(getPreset('moon').id).toBe(DEFAULT_WORLD_ID);
    expect(getPreset(null).id).toBe(DEFAULT_WORLD_ID);
    expect(getPreset(undefined).id).toBe(DEFAULT_WORLD_ID);
  });

  it('every registered preset is valid', () => {
    for (const preset of listPresets()) expect(validatePreset(preset)).toEqual([]);
  });

  it('construction has 5–7+ kinds of props', () => {
    const kinds = new Set(getPreset('construction').props.items.map((p) => p.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(5);
  });

  it('validation catches broken presets', () => {
    const broken = { ...getPreset('construction'), props: { perChunk: [3, 1] as [number, number], shoulderCones: 0, items: [] } };
    expect(validatePreset(broken).length).toBeGreaterThan(0);
  });
});

describe('road generator', () => {
  const road = new RoadGenerator(getPreset('construction').road.curve);

  it('is deterministic', () => {
    expect(road.centerX(1234.5)).toBe(road.centerX(1234.5));
  });

  it('has gentle curves (child-friendly)', () => {
    for (let s = 0; s < 5000; s += 5) {
      expect(Math.abs(road.slope(s))).toBeLessThan(0.6);
      expect(Math.abs(road.curvature(s))).toBeLessThan(0.02);
    }
  });

  it('frame vectors are unit length and perpendicular', () => {
    const f = road.frame(321);
    expect(Math.hypot(f.fx, f.fz)).toBeCloseTo(1);
    expect(Math.hypot(f.rx, f.rz)).toBeCloseTo(1);
    expect(f.fx * f.rx + f.fz * f.rz).toBeCloseTo(0);
  });
});
