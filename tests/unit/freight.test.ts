import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/game/config';
import { FreightRailway } from '../../src/world/FreightRailway';
import { getPreset } from '../../src/world/presets';
import { RoadGenerator } from '../../src/world/RoadGenerator';

const seaToSky = getPreset('sea-to-sky');
const cfg = seaToSky.freightRailway!;
const road = new RoadGenerator(seaToSky.road.curve);

function setup() {
  const railway = new FreightRailway(road, cfg, 9, () => 0);
  for (let slot = 0; slot < 9; slot++) railway.assign(slot, slot - 2);
  return railway;
}

describe('Sea to Sky steam freight', () => {
  it('keeps track segments outside the driving corridor when chunks recycle', () => {
    const railway = setup();
    const track = railway.group.children[0] as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    for (const chunk of [-2, 0, 40, 125]) {
      railway.assign(0, chunk);
      for (let segment = 0; segment < 8; segment++) {
        track.getMatrixAt(segment, matrix);
        position.setFromMatrixPosition(matrix);
        const s = chunk * 40 + (segment + 0.5) * 5;
        const expected = road.point(s, cfg.offset);
        expect(position.x).toBeCloseTo(expected.x, 4);
        expect(position.z).toBeCloseTo(expected.z, 3);
      }
    }
    expect(cfg.offset - 1.9).toBeGreaterThan(CONFIG.road.halfWidth + CONFIG.road.shoulderWidth);
  });

  it('moves in both directions, trails wagons on curved rails and pauses all animation with zero dt', () => {
    const railway = setup();
    const engine = railway.group.children[1] as THREE.InstancedMesh;
    const wagon = railway.group.children[3] as THREE.InstancedMesh;
    const wheels = railway.group.children[5] as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const directions = new Set<number>();
    let progress = 0;
    let checkedPause = false;
    for (let t = 0; t < 120; t += 0.1) {
      progress += 0.83;
      railway.update(0.1, progress);
      if (!railway.isTrainRunning()) continue;
      const state = railway as unknown as { lead: number; direction: number };
      directions.add(state.direction);
      engine.getMatrixAt(0, matrix);
      if (matrix.elements[0] === 0 && matrix.elements[10] === 0) continue;
      position.setFromMatrixPosition(matrix);
      const expected = road.point(state.lead, cfg.offset);
      expect(position.x).toBeCloseTo(expected.x, 3);
      expect(position.z).toBeCloseTo(expected.z, 3);
      wagon.getMatrixAt(0, matrix);
      if (Math.abs(matrix.determinant()) > 0.1) {
        position.setFromMatrixPosition(matrix);
        const trailing = road.point(state.lead - state.direction * 16.3, cfg.offset);
        expect(position.x).toBeCloseTo(trailing.x, 3);
        expect(position.z).toBeCloseTo(trailing.z, 3);
      }
      if (!checkedPause) {
        wheels.getMatrixAt(0, matrix);
        const before = matrix.clone();
        const lead = state.lead;
        railway.update(0, progress);
        wheels.getMatrixAt(0, matrix);
        expect(matrix.equals(before)).toBe(true);
        expect(state.lead).toBe(lead);
        checkedPause = true;
      }
    }
    expect(checkedPause).toBe(true);
    expect([...directions].sort()).toEqual([-1, 1]);
  });
});
