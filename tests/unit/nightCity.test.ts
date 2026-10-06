import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/game/config';
import { Guideway } from '../../src/world/Guideway';
import { NightLighting } from '../../src/world/NightLighting';
import { ObjectSpawner } from '../../src/world/ObjectSpawner';
import { getPreset, listPresets, validatePreset } from '../../src/world/presets';
import { RoadGenerator } from '../../src/world/RoadGenerator';

describe('Night City', () => {
  const city = getPreset('city');
  const night = city.sky.night!;
  const road = new RoadGenerator(city.road.curve);

  it('keeps the existing City selection and enables luminous surfaces only for its night preset', () => {
    expect(listPresets().filter((p) => p.sky.night).map((p) => p.id)).toEqual(['city']);
    expect(validatePreset(city)).toEqual([]);
    expect(validatePreset({ ...city, sky: { ...city.sky, night: { ...night, stars: 100000 } } }).join()).toContain('sky.night.stars');
    const props = { ...city.props, shoulderCones: 0,
      items: city.props.items.filter((p) => ['building', 'glassTower', 'shop', 'streetLamp'].includes(p.kind)) };
    const lit = new ObjectSpawner(road, props, 1, night);
    const day = new ObjectSpawner(road, props, 1);
    expect(lit.group.children.filter((m) => m instanceof THREE.Mesh && m.material instanceof THREE.MeshBasicMaterial).length).toBe(3);
    expect(day.group.children.some((m) => m instanceof THREE.Mesh && m.material instanceof THREE.MeshBasicMaterial)).toBe(false);
  });

  it('recycles lamp pools, uses a fixed number of actual lights, and keeps the moon and headlights with the bus', () => {
    const lighting = new NightLighting(road, city.props, night, 9);
    const objects: THREE.Object3D[] = [];
    lighting.group.traverse((o) => objects.push(o));
    expect(objects.filter((o) => o instanceof THREE.PointLight)).toHaveLength(2);
    expect(objects.filter((o) => o instanceof THREE.SpotLight)).toHaveLength(1);
    const stars = objects.find((o) => o instanceof THREE.Points) as THREE.Points;
    expect(stars.geometry.getAttribute('position').count).toBe(night.stars);
    const pools = objects.find((o) => o instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
    expect(pools.count).toBe(city.props.shoulderCones * 9);
    const focus = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    for (let chunk = 0; chunk < 90; chunk++) {
      const progress = chunk * CONFIG.world.chunkLength;
      for (let slot = 0; slot < 9; slot++) lighting.assign(slot, chunk + slot - 2);
      const p = road.point(progress, 0);
      focus.set(p.x, 0, p.z);
      lighting.update(progress, focus);
      expect(lighting.sky.position.distanceTo(focus)).toBe(0);
      for (const light of objects.filter((o) => o instanceof THREE.PointLight)) {
        expect(light.position.y).toBe(4.32);
        expect(light.position.distanceTo(focus)).toBeLessThan(18);
      }
      const firstChunk = chunk - 2;
      const s = (firstChunk + 0.5 / city.props.shoulderCones) * CONFIG.world.chunkLength;
      const side = firstChunk % 2 === 0 ? 1 : -1;
      const lamp = road.point(s, side * (6.5 + city.props.shoulderDistance! - 1.2));
      pools.getMatrixAt(0, matrix);
      expect(matrix.elements[12]).toBeCloseTo(lamp.x, 4);
      expect(matrix.elements[14]).toBeCloseTo(lamp.z, 3);
    }
    const after: THREE.Object3D[] = [];
    lighting.group.traverse((o) => after.push(o));
    expect(after).toEqual(objects);
  });

  it('moves train window lights with their cars and hides them when the train leaves', () => {
    const guideway = new Guideway(road, city.guideway!, 9, () => 0.9);
    const { train, trainWindows } = guideway as unknown as { train: THREE.InstancedMesh; trainWindows: THREE.InstancedMesh };
    const car = new THREE.Matrix4();
    const windows = new THREE.Matrix4();
    let seen = false;
    let hidden = false;
    for (let t = 0; t < 70; t += 0.5) {
      guideway.update(0.5, t * CONFIG.driving.speed);
      for (let i = 0; i < train.count; i++) {
        train.getMatrixAt(i, car);
        trainWindows.getMatrixAt(i, windows);
        expect(windows.elements).toEqual(car.elements);
      }
      if (guideway.isTrainRunning()) seen = true;
      else if (seen) hidden = true;
    }
    expect(seen).toBe(true);
    expect(hidden).toBe(true);
  });
});
