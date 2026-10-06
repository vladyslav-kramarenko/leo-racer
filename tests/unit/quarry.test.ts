import * as THREE from 'three';
import { expect, it } from 'vitest';
import { CONFIG } from '../../src/game/config';
import { ObjectSpawner } from '../../src/world/ObjectSpawner';
import { getPreset } from '../../src/world/presets';
import { RoadGenerator } from '../../src/world/RoadGenerator';

it('moves only the quarry truck and keeps its turning envelope clear of the road', () => {
  const preset = getPreset('construction');
  const road = new RoadGenerator(preset.road.curve);
  const spawner = new ObjectSpawner(road, preset.props, 1);
  const pools = (spawner as unknown as { pools: Map<string, {
    mesh: THREE.InstancedMesh; parts: { mesh: THREE.InstancedMesh }[];
  }> }).pools;
  const quarry = pools.get('quarry')!;
  const truck = quarry.parts[0].mesh;
  const matrix = new THREE.Matrix4();
  const scenery = new THREE.Matrix4();
  const point = new THREE.Vector3();
  const position = truck.geometry.getAttribute('position');
  for (const chunk of [1, 9, 17, 25]) {
    spawner.populate(0, chunk);
    quarry.mesh.getMatrixAt(0, scenery);
    spawner.animate(0);
    truck.getMatrixAt(0, matrix);
    const initial = matrix.clone();
    spawner.animate(8);
    truck.getMatrixAt(0, matrix);
    expect(matrix.equals(initial)).toBe(false);
    for (let t = 0; t <= 40; t += 2) {
      spawner.animate(t);
      truck.getMatrixAt(0, matrix);
      for (let vertex = 0; vertex < position.count; vertex += 3) {
        point.fromBufferAttribute(position, vertex).applyMatrix4(matrix);
        // Solve the closest road frame, accounting for lateral offset on bends.
        let s = -point.z;
        for (let i = 0; i < 5; i++) {
          const f = road.frame(s);
          s += (point.x - f.x) * f.fx + (point.z - f.z) * f.fz;
        }
        const f = road.frame(s);
        const lateral = (point.x - f.x) * f.rx + (point.z - f.z) * f.rz;
        expect(lateral).toBeGreaterThan(CONFIG.road.halfWidth + CONFIG.road.shoulderWidth);
      }
      quarry.mesh.getMatrixAt(0, matrix);
      expect(matrix.equals(scenery)).toBe(true);
    }
  }
});
