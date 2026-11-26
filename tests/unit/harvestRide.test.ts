import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { circuitPose } from '../../src/world/circuitPath';
import { ObjectSpawner } from '../../src/world/ObjectSpawner';
import { getPreset } from '../../src/world/presets';
import { RoadGenerator } from '../../src/world/RoadGenerator';

interface TestPool {
  mesh: THREE.InstancedMesh;
  active: boolean[];
  parts: { mesh: THREE.InstancedMesh }[];
}

describe('Farm harvest tractor ride', () => {
  const preset = getPreset('farm');
  const road = new RoadGenerator(preset.road.curve);

  it('follows a continuous track at a slow, constant speed, including turns and loop wrap', () => {
    const length = 36 + Math.PI * 18;
    for (const distance of [0, 18, 18 + Math.PI * 9, 36 + Math.PI * 9, length, -5.5]) {
      const p = circuitPose(distance, 9, 9);
      const next = circuitPose(distance + 0.001, 9, 9);
      const direction = new THREE.Vector2(-Math.sin(p.yaw), -Math.cos(p.yaw));
      const delta = new THREE.Vector2(next.x - p.x, next.z - p.z);
      expect(delta.length()).toBeCloseTo(0.001, 6);
      expect(delta.normalize().dot(direction)).toBeGreaterThan(0.9999);
    }
  });

  it('keeps the tractor and all three wagons off the road, follows turns, and joins the hitches', () => {
    const props = new ObjectSpawner(road, {
      ...preset.props, perChunk: [0, 0], shoulderCones: 0,
      items: preset.props.items.filter((spec) => spec.kind === 'harvestRide'),
    }, 1);
    const ride = (props as unknown as { pools: Map<string, TestPool> }).pools.get('harvestRide')!;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const next = new THREE.Vector3();
    const forward = new THREE.Vector3();
    const vehicles = [0, 1, 3, 5];
    const bounds = vehicles.map((index) => {
      const geometry = ride.parts[index].mesh.geometry;
      geometry.computeBoundingBox();
      return geometry.boundingBox!;
    });
    for (const chunk of [3, 9, 15, 45]) {
      props.populate(0, chunk);
      expect(ride.active[0]).toBe(true);
      for (let t = 0; t < 50; t += 2) {
        props.animate(t);
        const poses = vehicles.map((index) => {
          ride.parts[index].mesh.getMatrixAt(0, matrix);
          return matrix.clone();
        });
        for (let i = 0; i < vehicles.length; i++) {
          const mesh = ride.parts[vehicles[i]].mesh;
          for (const x of [bounds[i].min.x, bounds[i].max.x]) for (const z of [bounds[i].min.z, bounds[i].max.z]) {
            position.set(x, 0, z).applyMatrix4(poses[i]);
            const lateral = (position.x - road.centerX(-position.z)) / Math.hypot(1, road.slope(-position.z));
            expect(lateral).toBeGreaterThan(6.5);
          }
          position.setFromMatrixPosition(poses[i]);
          forward.set(0, 0, -1).transformDirection(poses[i]);
          props.animate(t + 0.01);
          mesh.getMatrixAt(0, matrix);
          next.setFromMatrixPosition(matrix);
          expect(next.sub(position).normalize().dot(forward)).toBeGreaterThan(0.999);
          props.animate(t);
        }
        for (let i = 0; i < 3; i++) {
          ride.parts[2 + 2 * i].mesh.getMatrixAt(0, matrix);
          const a = new THREE.Vector3(0, 0, -0.5).applyMatrix4(matrix);
          const b = new THREE.Vector3(0, 0, 0.5).applyMatrix4(matrix);
          const front = new THREE.Vector3(0, 0.65, -2).applyMatrix4(poses[i + 1]);
          const rear = new THREE.Vector3(0, 0.65, 1.9).applyMatrix4(poses[i]);
          // Instanced transforms use Float32 coordinates, including kilometres from the origin.
          expect(a.distanceTo(front)).toBeLessThan(0.001);
          expect(b.distanceTo(rear)).toBeLessThan(0.001);
        }
      }
    }
  });

  it('reserves the ride field, freezes at the same simulation time, and clears every part on recycling', () => {
    const props = new ObjectSpawner(road, preset.props, 3);
    const pools = (props as unknown as { pools: Map<string, TestPool> }).pools;
    props.populate(1, 2);
    props.populate(0, 3);
    props.populate(2, 4);
    props.animate(10);
    const ride = pools.get('harvestRide')!;
    const base = new THREE.Matrix4();
    const matrix = new THREE.Matrix4();
    const point = new THREE.Vector3();
    ride.mesh.getMatrixAt(0, base);
    const inverse = base.clone().invert();
    for (const [kind, pool] of pools) {
      if (kind === 'harvestRide' || kind === 'fence' || kind === 'harvestStand') continue;
      for (let i = 0; i < pool.active.length; i++) {
        if (!pool.active[i]) continue;
        pool.mesh.getMatrixAt(i, matrix);
        point.setFromMatrixPosition(matrix).applyMatrix4(inverse);
        expect(Math.abs(point.x) >= 19.999 || Math.abs(point.z) >= 29.999, kind).toBe(true);
      }
    }
    const before = ride.parts.map((p) => Array.from(p.mesh.instanceMatrix.array));
    props.animate(10);
    expect(ride.parts.map((p) => Array.from(p.mesh.instanceMatrix.array))).toEqual(before);
    const children = props.group.children.slice();
    props.populate(0, 5);
    props.animate(11);
    expect(ride.active[0]).toBe(false);
    for (const mesh of [ride.mesh, ...ride.parts.map((p) => p.mesh)]) {
      mesh.getMatrixAt(0, matrix);
      expect(matrix.determinant()).toBe(0);
    }
    expect(props.group.children).toEqual(children);
  });
});
