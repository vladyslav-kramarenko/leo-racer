import { describe, expect, it } from 'vitest';
import { DEFAULT_WORLD_ID, getPreset, listPresets, validatePreset } from '../../src/world/presets';
import { buildPropModel, PROP_KINDS } from '../../src/world/props';
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

  it('ships six worlds, each loadable by id', () => {
    expect(listPresets().map((p) => p.id)).toEqual(['construction', 'sea-to-sky', 'nature', 'winter', 'farm', 'city']);
    for (const id of ['construction', 'sea-to-sky', 'nature', 'winter', 'farm', 'city']) expect(getPreset(id).id).toBe(id);
  });

  it('every world has 5+ kinds of props', () => {
    for (const preset of listPresets()) {
      const kinds = new Set(preset.props.items.map((p) => p.kind));
      expect(kinds.size, preset.id).toBeGreaterThanOrEqual(5);
    }
  });

  it('every prop kind used by a preset builds, and animated parts are safe', () => {
    for (const kind of PROP_KINDS) {
      const model = buildPropModel(kind);
      expect(model.body.getAttribute('position').count, kind).toBeGreaterThan(0);
      for (const part of model.parts ?? []) {
        if (part.anim.type === 'blink') expect(part.anim.hz, `${kind} blink`).toBeLessThan(3);
      }
    }
    const used = new Set(listPresets().flatMap((p) => [...p.props.items.map((i) => i.kind), p.props.shoulderProp ?? 'cone']));
    for (const kind of used) expect(PROP_KINDS).toContain(kind);
  });

  it('nothing is placed inside the driving corridor', () => {
    const edge = 6.5;
    for (const preset of listPresets()) {
      for (const item of preset.props.items) {
        // Bus can reach 3.3 m + half its width 1.25 m.
        expect(edge + item.minDistance, `${preset.id}/${item.kind}`).toBeGreaterThan(4.55);
      }
    }
  });

  it('validation catches broken presets', () => {
    const broken = { ...getPreset('construction'), props: { perChunk: [3, 1] as [number, number], shoulderCones: 0, items: [] } };
    expect(validatePreset(broken).length).toBeGreaterThan(0);
    const corridor = {
      ...getPreset('city'),
      props: { ...getPreset('city').props, items: [{ kind: 'house' as const, weight: 1, minDistance: -3, maxDistance: 0, scale: [1, 1] as [number, number], maxPerChunk: 1 }] },
    };
    expect(validatePreset(corridor).join()).toContain('driving corridor');
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
