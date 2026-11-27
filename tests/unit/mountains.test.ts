import { describe, expect, it } from 'vitest';
import { createMountainRange } from '../../src/world/mountains';
import { getPreset } from '../../src/world/presets';

describe('faceted alpine horizon', () => {
  it.each(['sea-to-sky', 'nature', 'winter'])('builds a bounded, deterministic mesh for %s', (id) => {
    const hills = getPreset(id).sky.hills;
    const a = createMountainRange(hills, 195);
    const b = createMountainRange(hills, 195);
    try {
      const p = a.getAttribute('position');
      const c = a.getAttribute('color');
      const n = a.getAttribute('normal');
      expect(p.count / 3).toBe(46 * 60);
      expect(c.count).toBe(p.count);
      expect(n.count).toBe(p.count);
      expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
      expect(Array.from(n.array).every(Number.isFinite)).toBe(true);
      expect(Array.from(p.array)).toEqual(Array.from(b.getAttribute('position').array));
      a.computeBoundingBox();
      expect(a.boundingBox!.min.y).toBe(-1);
      expect(a.boundingBox!.max.y).toBeLessThanOrEqual(hills.height[1]);
      expect(new Set(Array.from(c.array)).size).toBeGreaterThan(10);
    } finally {
      a.dispose();
      b.dispose();
    }
  });
});
