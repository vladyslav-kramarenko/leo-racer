import * as THREE from 'three';
import { expect, it } from 'vitest';
import { CONFIG } from '../../src/game/config';
import { ObjectSpawner } from '../../src/world/ObjectSpawner';
import { getPreset } from '../../src/world/presets';
import { pipeTrench } from '../../src/world/pipeTrench';
import { RoadGenerator } from '../../src/world/RoadGenerator';

it('opens the terrain only at active excavation sites and closes it on chunk recycling', () => {
  const preset = getPreset('construction');
  const road = new RoadGenerator(preset.road.curve);
  const props = new ObjectSpawner(road, preset.props, 2);
  props.populate(0, 3);
  props.populate(1, 11);
  expect(props.groundCutouts.filter((hole) => hole.z > 0)).toHaveLength(2);
  for (const hole of props.groundCutouts) {
    let s = -hole.y;
    for (let i = 0; i < 5; i++) {
      const frame = road.frame(s);
      s += (hole.x - frame.x) * frame.fx + (hole.y - frame.z) * frame.fz;
    }
    const frame = road.frame(s);
    const distance = Math.abs((hole.x - frame.x) * frame.rx + (hole.y - frame.z) * frame.rz);
    expect(distance - hole.z).toBeGreaterThan(CONFIG.road.halfWidth + CONFIG.road.shoulderWidth);
  }
  props.populate(0, 4);
  expect(props.groundCutouts.filter((hole) => hole.z > 0)).toHaveLength(1);
  props.populate(1, 12);
  expect(props.groundCutouts.every((hole) => hole.z === 0)).toBe(true);
});

it('has an excavation floor and pipeline below the surrounding ground', () => {
  const model = pipeTrench();
  model.body.computeBoundingBox();
  expect(model.body.boundingBox!.min.y).toBeLessThan(-2);
  expect(model.groundCutout!.size).toEqual([3.8, 24]);
  const position = model.body.getAttribute('position');
  const colors = model.body.getAttribute('color');
  const pipeColor = new THREE.Color('#358dcb');
  let buriedPipe = false;
  for (let i = 0; i < position.count; i++) {
    if (position.getY(i) < -0.5 && Math.abs(position.getX(i)) < 0.8
      && Math.abs(colors.getZ(i) - pipeColor.b) < 0.001) buriedPipe = true;
  }
  expect(buriedPipe).toBe(true);
  model.body.dispose();
});
