import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ObjectSpawner } from '../../src/world/ObjectSpawner';
import { getPreset } from '../../src/world/presets';
import { buildPropModel } from '../../src/world/props';
import { RoadGenerator } from '../../src/world/RoadGenerator';

interface TestPool {
  mesh: THREE.InstancedMesh;
  active: boolean[];
}

describe('Autumn Farm', () => {
  const preset = getPreset('farm');

  it('keeps the saved Farm identity and farm life while adding the harvest scenery', () => {
    expect(preset.name).toBe('Farm');
    expect(preset.road.centerLine).toBeNull();
    expect(preset.road.edgeLine).toBeNull();
    for (const kind of ['barn', 'cow', 'sheep', 'windmill', 'tractor', 'pumpkinPatch', 'harvestStand', 'autumnTree', 'cornRows']) {
      expect(preset.props.items.some((spec) => spec.kind === kind), kind).toBe(true);
    }
    expect(preset.props.items.some((spec) => spec.kind === 'roundTree')).toBe(false);
  });

  it('keeps the full harvest scenes and roadside pumpkins outside the driving corridor', () => {
    for (const spec of preset.props.items.filter((spec) => ['autumnTree', 'pumpkinPile', 'pumpkinPatch', 'harvestStand', 'scarecrow', 'leafPile', 'cornRows'].includes(spec.kind))) {
      const model = buildPropModel(spec.kind);
      model.body.computeBoundingBox();
      const bounds = model.body.boundingBox!;
      const reach = spec.facing === 'road' ? -bounds.min.z
        : Math.hypot(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)), Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)));
      expect(6.5 + spec.minDistance - reach * spec.scale[1], spec.kind).toBeGreaterThan(4.55);
      model.body.dispose();
    }
  });

  it('places fields regularly, keeps random props out of them, and clears them on chunk recycling', () => {
    const road = new RoadGenerator(preset.road.curve);
    const props = new ObjectSpawner(road, preset.props, 1);
    const pools = (props as unknown as { pools: Map<string, TestPool> }).pools;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    for (const chunk of [1, 7, 13]) {
      props.populate(0, chunk);
      const patch = pools.get('pumpkinPatch')!;
      expect(patch.active[0]).toBe(true);
      patch.mesh.getMatrixAt(0, matrix);
      const inverse = matrix.clone().invert();
      for (const [kind, pool] of pools) {
        if (kind === 'pumpkinPatch' || kind === 'fence') continue;
        for (let i = 0; i < pool.active.length; i++) {
          if (!pool.active[i]) continue;
          pool.mesh.getMatrixAt(i, matrix);
          position.setFromMatrixPosition(matrix).applyMatrix4(inverse);
          expect(Math.abs(position.x) >= 12.99 || Math.abs(position.z) >= 11.49, kind).toBe(true);
        }
      }
    }
    props.populate(0, 2);
    expect(pools.get('pumpkinPatch')!.active[0]).toBe(false);
    pools.get('pumpkinPatch')!.mesh.getMatrixAt(0, matrix);
    expect(matrix.determinant()).toBe(0);
    props.populate(0, 4);
    expect(pools.get('harvestStand')!.active[0]).toBe(true);
  });
});
