import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/game/config';
import { Guideway } from '../../src/world/Guideway';
import { ObjectSpawner } from '../../src/world/ObjectSpawner';
import { getPreset } from '../../src/world/presets';
import { RoadGenerator } from '../../src/world/RoadGenerator';

const city = getPreset('city');
const road = new RoadGenerator(city.road.curve);

/** How many instances of a kind are placed (non-zero scale) in a pool. */
function placed(spawner: ObjectSpawner, kind: string): number {
  const pool = (spawner as unknown as { pools: Map<string, { active: boolean[] }> }).pools.get(kind);
  return pool ? pool.active.filter(Boolean).length : 0;
}

describe('city landmarks', () => {
  it('appear exactly once every N chunks, at the configured phase', () => {
    const spawner = new ObjectSpawner(road, city.props, 1);
    const science = city.props.items.find((i) => i.kind === 'scienceWorld')!;
    const { chunks, offset = 0 } = science.every!;
    for (let chunk = 0; chunk < 48; chunk++) {
      spawner.populate(0, chunk);
      const expected = (chunk - offset) % chunks === 0 ? 1 : 0;
      expect(placed(spawner, 'scienceWorld'), `chunk ${chunk}`).toBe(expected);
    }
  });

  it('landmarks are never picked by the random roadside placement', () => {
    const spawner = new ObjectSpawner(road, city.props, 1);
    let total = 0;
    for (let chunk = 0; chunk < 120; chunk++) {
      spawner.populate(0, chunk);
      total += placed(spawner, 'harbourCentre');
    }
    const { chunks, offset = 0 } = city.props.items.find((i) => i.kind === 'harbourCentre')!.every!;
    const expected = Array.from({ length: 120 }, (_, c) => c).filter((c) => (c - offset) % chunks === 0).length;
    expect(total).toBe(expected);
  });
});

describe('SkyTrain guideway', () => {
  it('runs a train that stays on the guideway, clear of the road', () => {
    let r = 0.2;
    const rng = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    const guideway = new Guideway(road, city.guideway!, 9, rng);
    for (let slot = 0; slot < 9; slot++) guideway.assign(slot, slot - 2);

    const train = (guideway as unknown as { train: THREE.InstancedMesh }).train;
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    let seenTrain = false;
    let progress = 0;
    for (let t = 0; t < 90; t += 0.1) {
      progress += CONFIG.driving.speed * 0.1;
      guideway.update(0.1, progress);
      if (!guideway.isTrainRunning()) continue;
      seenTrain = true;
      train.getMatrixAt(0, m);
      pos.setFromMatrixPosition(m);
      // Above the beam, well over any vehicle.
      expect(pos.y).toBeGreaterThan(city.guideway!.height);
    }
    expect(seenTrain).toBe(true);
  });

  it('the guideway sits outside the road corridor', () => {
    expect(city.guideway!.offset - city.guideway!.width / 2).toBeGreaterThan(CONFIG.road.halfWidth + CONFIG.road.shoulderWidth);
  });
});
