import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/game/config';
import { CameraRig } from '../../src/game/CameraRig';
import { CropDuster } from '../../src/world/CropDuster';
import { getPreset, listPresets, validatePreset } from '../../src/world/presets';
import { RoadGenerator } from '../../src/world/RoadGenerator';

const farm = getPreset('farm');

describe('Farm biplane', () => {
  it('flies in both directions above farm buildings, reuses its model and pauses the propeller', () => {
    const plane = new CropDuster(new RoadGenerator(farm.road.curve), farm.cropDuster!, () => 0);
    const objects = [...plane.group.children];
    const propeller = plane.group.getObjectByName('biplane-propeller')!;
    const directions: number[] = [];
    let flying = false;
    let startX = 0;
    let paused = false;
    let progress = 0;
    expect(plane.group.visible).toBe(false);
    for (let t = 0; t < 75; t += 0.1) {
      progress += 0.83;
      plane.update(0.1, progress);
      if (plane.isFlying()) {
        if (!flying) startX = plane.group.position.x;
        plane.group.updateMatrixWorld(true);
        expect(new THREE.Box3().setFromObject(plane.group).min.y).toBeGreaterThan(20);
        if (!paused) {
          const before = plane.group.matrixWorld.clone();
          const angle = propeller.rotation.z;
          plane.update(0, progress);
          plane.group.updateMatrixWorld(true);
          expect(plane.group.matrixWorld.equals(before)).toBe(true);
          expect(propeller.rotation.z).toBe(angle);
          plane.update(0.01, progress + 0.083);
          expect(propeller.rotation.z).not.toBe(angle);
          paused = true;
        }
      } else if (flying) directions.push(Math.sign(plane.group.position.x - startX));
      flying = plane.isFlying();
    }
    expect(directions).toEqual([1, -1]);
    expect(paused).toBe(true);
    expect(plane.group.children).toEqual(objects);
  });

  it('crosses ahead of the bus inside the camera view at cruise and boosted speeds', () => {
    for (const speed of [8.3, 24.9, 36.1]) {
      const road = new RoadGenerator(farm.road.curve);
      const plane = new CropDuster(road, farm.cropDuster!, () => 0);
      const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 16 / 9, 0.1, CONFIG.camera.far);
      const rig = new CameraRig(camera, road);
      let progress = 0;
      for (let step = 0; step < 121; step++) {
        progress += speed * 0.1;
        plane.update(0.1, progress);
        rig.update(0.1, progress, 0, 0);
      }
      expect(plane.isFlying()).toBe(true);
      const crossingS = -plane.group.position.z;
      expect(crossingS - progress).toBeGreaterThan(75);
      expect(crossingS - progress).toBeLessThan(85);
      expect(Math.abs(plane.group.position.x - road.centerX(crossingS))).toBeLessThan(3);
      camera.updateMatrixWorld(true);
      const screen = plane.group.position.clone().project(camera);
      expect(Math.abs(screen.x)).toBeLessThan(1);
      expect(Math.abs(screen.y)).toBeLessThan(1);
      expect(screen.z).toBeLessThan(1);
    }
  });

  it('is enabled only in Farm and rejects low or invalid flight presets', () => {
    expect(listPresets().filter((preset) => preset.cropDuster).map((preset) => preset.id)).toEqual(['farm']);
    expect(validatePreset({ ...farm, cropDuster: { altitude: 5, intervalSec: [28, 43] } }).join()).toContain('cropDuster.altitude');
    expect(validatePreset({ ...farm, cropDuster: { altitude: 24, intervalSec: [43, 28] } }).join()).toContain('cropDuster.intervalSec');
  });
});
