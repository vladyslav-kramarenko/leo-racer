import { describe, expect, it } from 'vitest';
import { pickWeighted } from '../../src/drawings/DrawingSprite';
import { CONFIG } from '../../src/game/config';
import { TrafficManager } from '../../src/traffic/TrafficManager';
import { avoidanceTarget, overlapsBus } from '../../src/world/laneAvoidance';
import { getPreset } from '../../src/world/presets';
import { RoadGenerator } from '../../src/world/RoadGenerator';

const { laneOffset, shoulderOffset } = CONFIG.lanes;

describe('lane avoidance (make way for the bus)', () => {
  it('stays in lane when the bus is far away along the road', () => {
    expect(avoidanceTarget({ s: 200, laneD: laneOffset, d: laneOffset, busS: 0, busD: laneOffset })).toBe(laneOffset);
  });

  it('stays in lane when there is enough sideways room', () => {
    expect(avoidanceTarget({ s: 10, laneD: laneOffset, d: laneOffset, busS: 0, busD: -2.5 })).toBe(laneOffset);
  });

  it('pulls onto its own shoulder when the bus approaches in its lane', () => {
    expect(avoidanceTarget({ s: 15, laneD: laneOffset, d: laneOffset, busS: 0, busD: 0.5 })).toBe(shoulderOffset);
    expect(avoidanceTarget({ s: 15, laneD: -laneOffset, d: -laneOffset, busS: 0, busD: -0.5 })).toBe(-shoulderOffset);
  });

  it('chooses the other side when the bus is hugging its shoulder', () => {
    const target = avoidanceTarget({ s: 15, laneD: laneOffset, d: laneOffset, busS: 0, busD: 3.3 });
    expect(Math.abs(target - 3.3)).toBeGreaterThanOrEqual(CONFIG.lanes.clearance);
    expect(target).toBeLessThan(0);
  });

  it('for any bus position the chosen spot keeps the required clearance', () => {
    for (let busD = -3.3; busD <= 3.3; busD += 0.1) {
      for (const laneD of [laneOffset, -laneOffset]) {
        const t = avoidanceTarget({ s: 5, laneD, d: laneD, busS: 0, busD });
        expect(Math.abs(t - busD)).toBeGreaterThanOrEqual(CONFIG.lanes.clearance - 1e-9);
      }
    }
  });

  it('detects overlap only when really close', () => {
    expect(overlapsBus(2, 0.5, 0, 0, 0.9)).toBe(true);
    expect(overlapsBus(2, 5.6, 0, 0, 0.9)).toBe(false);
    expect(overlapsBus(20, 0, 0, 0, 0.9)).toBe(false);
  });
});

describe('drawing frequency', () => {
  const seq = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it('weights Often above Normal above Rare', () => {
    const items = [
      { id: 'rare', frequency: 'rare' as const },
      { id: 'normal', frequency: 'normal' as const },
      { id: 'often', frequency: 'often' as const },
    ];
    const counts: Record<string, number> = { rare: 0, normal: 0, often: 0 };
    let rng = 0.123;
    const random = () => (rng = (rng * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 6000; i++) counts[pickWeighted(items, random, null)!.id]++;
    expect(counts.often).toBeGreaterThan(counts.normal);
    expect(counts.normal).toBeGreaterThan(counts.rare);
    expect(counts.rare).toBeGreaterThan(0);
  });

  it('avoids showing the same drawing twice in a row when there is a choice', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    expect(pickWeighted(items, seq([0]), 'a')!.id).toBe('b');
    expect(pickWeighted([{ id: 'a' }], seq([0]), 'a')!.id).toBe('a');
    expect(pickWeighted([], seq([0]), null)).toBeNull();
  });
});

describe('built-in traffic', () => {
  const preset = getPreset('construction');
  const road = new RoadGenerator(preset.road.curve);

  it('spawns up to the density cap and never more', () => {
    const traffic = new TrafficManager(road, preset.traffic, 'busy', () => 0.3);
    let s = 0;
    for (let t = 0; t < 120; t += 0.1) {
      s += CONFIG.driving.speed * 0.1;
      traffic.update(0.1, t, { s, d: 0 });
      expect(traffic.activeCount()).toBeLessThanOrEqual(CONFIG.traffic.density.busy.max);
    }
    expect(traffic.activeCount()).toBeGreaterThan(0);
  });

  it('off means no traffic, and lowering density thins it out', () => {
    const traffic = new TrafficManager(road, preset.traffic, 'busy');
    for (let t = 0; t < 60; t += 0.1) traffic.update(0.1, t, { s: t * 8, d: 0 });
    traffic.setDensity('low');
    expect(traffic.activeCount()).toBeLessThanOrEqual(CONFIG.traffic.density.low.max);
    traffic.setDensity('off');
    expect(traffic.activeCount()).toBe(0);
  });

  it('a world with traffic disabled never spawns any', () => {
    const traffic = new TrafficManager(road, { enabled: false, vehicles: [] }, 'busy');
    for (let t = 0; t < 30; t += 0.1) traffic.update(0.1, t, { s: t * 8, d: 0 });
    expect(traffic.activeCount()).toBe(0);
  });
});
