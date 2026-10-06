import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { getPreset, listPresets, validatePreset } from '../../src/world/presets';
import { RoadGenerator } from '../../src/world/RoadGenerator';
import { SantaSleigh } from '../../src/world/SantaSleigh';

const winter = getPreset('winter');

describe('Santa flypast', () => {
  it('crosses the road in both directions, clears the village, and freezes on pause', () => {
    const road = new RoadGenerator(winter.road.curve);
    const sleigh = new SantaSleigh(road, winter.santaSleigh!, () => 0);
    const originalObjects = [...sleigh.group.children];
    expect(sleigh.group.visible).toBe(false);
    const crossingDirections: number[] = [];
    let lastFlying = false;
    let startX = 0;
    let progress = 0;
    let paused = false;
    for (let t = 0; t < 65; t += 0.1) {
      progress += 0.83;
      sleigh.update(0.1, progress);
      if (sleigh.isFlying()) {
        if (!lastFlying) startX = sleigh.group.position.x;
        sleigh.group.updateMatrixWorld(true);
        // Includes runners, articulated legs and waving hand in world coordinates.
        const bounds = new THREE.Box3().setFromObject(sleigh.group);
        expect(bounds.min.y).toBeGreaterThan(32);
        if (!paused) {
          const before = sleigh.group.matrixWorld.clone();
          const arm = sleigh.group.children[1].matrixWorld.clone();
          const legs = (sleigh.group.children[2] as THREE.InstancedMesh).instanceMatrix.array.slice();
          sleigh.update(0, progress);
          sleigh.group.updateMatrixWorld(true);
          expect(sleigh.group.matrixWorld.equals(before)).toBe(true);
          expect(sleigh.group.children[1].matrixWorld.equals(arm)).toBe(true);
          expect((sleigh.group.children[2] as THREE.InstancedMesh).instanceMatrix.array).toEqual(legs);
          paused = true;
        }
      } else if (lastFlying) crossingDirections.push(Math.sign(sleigh.group.position.x - startX));
      lastFlying = sleigh.isFlying();
    }
    expect(crossingDirections).toEqual([1, -1]);
    expect(paused).toBe(true);
    expect(sleigh.group.children).toEqual(originalObjects);
  });

  it('keeps the mid-flight crossing ahead of the bus at cruise and boost speeds', () => {
    const road = new RoadGenerator(winter.road.curve);
    for (const speed of [8.3, 24.9, 36.1]) {
      const sleigh = new SantaSleigh(road, winter.santaSleigh!, () => 0);
      let progress = 0;
      for (let step = 0; step < 100; step++) {
        progress += speed * 0.1;
        sleigh.update(0.1, progress);
      }
      expect(sleigh.isFlying()).toBe(true);
      const crossingS = -sleigh.group.position.z;
      // At 10 s: first appearance at 4 s + half of the 12 s crossing.
      expect(crossingS - progress).toBeGreaterThan(105);
      expect(crossingS - progress).toBeLessThan(115);
      expect(Math.abs(sleigh.group.position.x - road.centerX(crossingS))).toBeLessThan(2);
    }
  });

  it('belongs only to Winter and rejects flights below the ski slope', () => {
    expect(listPresets().filter((p) => p.santaSleigh).map((p) => p.id)).toEqual(['winter']);
    expect(validatePreset({ ...winter, santaSleigh: { altitude: 5, intervalSec: [25, 40] } }).join()).toContain('altitude');
    expect(validatePreset({ ...winter, santaSleigh: { altitude: 34, intervalSec: [40, 25] } }).join()).toContain('intervalSec');
  });
});
