import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ObjectSpawner } from '../../src/world/ObjectSpawner';
import { getPreset } from '../../src/world/presets';
import { RoadGenerator } from '../../src/world/RoadGenerator';
import { wildlifeBridge } from '../../src/world/wildlife';

describe('Banff-inspired Nature', () => {
  it('has wildlife and overpasses while the coastal train and sea stay in Sea to Sky', () => {
    const forest = getPreset('nature');
    const coast = getPreset('sea-to-sky');
    expect(coast.name).toBe('Sea to Sky');
    expect(coast.freightRailway).toBeDefined();
    expect(coast.terrain.bands!.some((band) => band.to >= 300)).toBe(true);
    expect(forest.freightRailway).toBeUndefined();
    expect(forest.terrain.bands).toBeUndefined();
    for (const kind of ['elk', 'moose', 'bear', 'wolf', 'bighorn', 'wildlifeBridge']) {
      expect(forest.props.items.some((spec) => spec.kind === kind)).toBe(true);
    }
  });

  it('leaves at least 6.4 metres of headroom across the entire road portal', () => {
    const model = wildlifeBridge();
    const mesh = new THREE.Mesh(model.body, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const ray = new THREE.Raycaster();
    for (const x of [-6.5, -4, 0, 4, 6.5]) {
      for (const z of [-6, 0, 6]) {
        ray.set(new THREE.Vector3(x, 0.1, z), new THREE.Vector3(0, 1, 0));
        const hits = ray.intersectObject(mesh);
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].point.y).toBeGreaterThanOrEqual(6.4);
      }
    }
    expect(model.parts![0].pivot[1]).toBe(8.5);
    model.body.dispose();
    model.parts!.forEach((part) => part.geometry.dispose());
  });

  it('centers bridges over the road and keeps forest props outside their ramps', () => {
    const preset = getPreset('nature');
    const road = new RoadGenerator(preset.road.curve);
    const props = new ObjectSpawner(road, preset.props, 1);
    const pools = (props as unknown as { pools: Map<string, {
      mesh: THREE.InstancedMesh; active: boolean[]; parts: { mesh: THREE.InstancedMesh }[];
    }> }).pools;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    for (const chunk of [2, 10, 18]) {
      props.populate(0, chunk);
      const bridge = pools.get('wildlifeBridge')!;
      expect(bridge.active[0]).toBe(true);
      bridge.mesh.getMatrixAt(0, matrix);
      position.setFromMatrixPosition(matrix);
      expect(position.x).toBeCloseTo(road.centerX(-position.z), 4);
      const inverse = matrix.clone().invert();
      for (const [kind, pool] of pools) {
        if (kind === 'wildlifeBridge') continue;
        for (let i = 0; i < pool.active.length; i++) {
          if (!pool.active[i]) continue;
          pool.mesh.getMatrixAt(i, matrix);
          position.setFromMatrixPosition(matrix).applyMatrix4(inverse);
          expect(Math.abs(position.x) >= 34 || Math.abs(position.z) >= 12).toBe(true);
        }
      }
      props.animate(0);
      bridge.parts[0].mesh.getMatrixAt(0, matrix);
      const start = matrix.clone();
      props.animate(9);
      bridge.parts[0].mesh.getMatrixAt(0, matrix);
      expect(matrix.equals(start)).toBe(false);
      position.setFromMatrixPosition(matrix).applyMatrix4(inverse);
      expect(position.y).toBeCloseTo(8.5, 4);
      expect(Math.abs(position.x)).toBeLessThanOrEqual(8.01);
    }
  });
});
