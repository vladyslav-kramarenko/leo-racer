import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildTrafficGeometries, HALF_WIDTH, SPEED_FACTOR } from '../../src/traffic/TrafficVehicle';
import { ObjectSpawner } from '../../src/world/ObjectSpawner';
import { getPreset, validatePreset } from '../../src/world/presets';
import { buildPropModel } from '../../src/world/props';
import { RoadGenerator } from '../../src/world/RoadGenerator';
import { Snowfall } from '../../src/world/Snowfall';

interface TestPool {
  mesh: THREE.InstancedMesh;
  active: boolean[];
  parts: { mesh: THREE.InstancedMesh }[];
}

describe('Winter scenes', () => {
  const preset = getPreset('winter');
  const road = new RoadGenerator(preset.road.curve);

  it('leaves the driving corridor clear, including snowbanks and entire animated landmarks', () => {
    for (const spec of preset.props.items) {
      const model = buildPropModel(spec.kind);
      model.body.computeBoundingBox();
      const bounds = model.body.boundingBox!.clone();
      for (const part of model.parts ?? []) {
        part.geometry.computeBoundingBox();
        const local = part.geometry.boundingBox!.clone();
        if (part.anim.type === 'swing' && part.anim.axis === 'y') {
          const radius = Math.hypot(Math.max(Math.abs(local.min.x), Math.abs(local.max.x)),
            Math.max(Math.abs(local.min.z), Math.abs(local.max.z)));
          local.min.x = local.min.z = -radius;
          local.max.x = local.max.z = radius;
        }
        const start = local.translate(new THREE.Vector3(...part.pivot));
        bounds.union(start);
        if (part.anim.type === 'slide') bounds.union(start.clone().translate(new THREE.Vector3(...part.anim.vector)));
        if (part.anim.type === 'orbit') {
          bounds.union(start.clone().translate(new THREE.Vector3(part.anim.radius[0], 0, part.anim.radius[1])));
          bounds.union(start.clone().translate(new THREE.Vector3(-part.anim.radius[0], 0, -part.anim.radius[1])));
        }
      }
      const reach = spec.facing === 'road' ? -bounds.min.z : spec.facing === 'traffic'
        ? Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x))
        : Math.hypot(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)), Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)));
      expect(6.5 + spec.minDistance - reach * spec.scale[1], spec.kind).toBeGreaterThan(4.55);
      model.body.dispose();
      model.parts?.forEach((part) => part.geometry.dispose());
    }
  });

  it('keeps skiers on the slope and chairs on their rising cables', () => {
    const props = new ObjectSpawner(road, preset.props, 1);
    props.populate(0, 1);
    const pools = (props as unknown as { pools: Map<string, TestPool> }).pools;
    const slope = pools.get('skiSlope')!;
    expect(slope.active[0]).toBe(true);
    const base = new THREE.Matrix4();
    slope.mesh.getMatrixAt(0, base);
    const inverse = base.clone().invert();
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    for (const t of [0, 3, 8, 14, 29]) {
      props.animate(t);
      for (let i = 0; i < 3; i++) {
        slope.parts[i].mesh.getMatrixAt(0, matrix);
        position.setFromMatrixPosition(matrix.premultiply(inverse));
        expect(position.y).toBeCloseTo(position.z / 2 + 0.2, 4);
        expect(position.z).toBeGreaterThanOrEqual(3.9999);
        expect(position.z).toBeLessThanOrEqual(40.0001);
        expect(Math.abs(position.x)).toBeLessThan(7);
      }
      for (const i of [3, 4]) {
        slope.parts[i].mesh.getMatrixAt(0, matrix);
        position.setFromMatrixPosition(matrix.premultiply(inverse));
        expect(position.y).toBeCloseTo(position.z / 2, 4);
      }
    }
    // A recycled chunk hides the whole scene, including all moving elements.
    props.populate(0, 2);
    props.animate(30);
    expect(slope.active[0]).toBe(false);
    for (const part of slope.parts) {
      part.mesh.getMatrixAt(0, matrix);
      expect(new THREE.Vector3().setFromMatrixScale(matrix).length()).toBe(0);
    }
  });

  it('skaters stay on the ice and face their direction of travel', () => {
    const props = new ObjectSpawner(road, preset.props, 1);
    props.populate(0, 4);
    const rink = (props as unknown as { pools: Map<string, TestPool> }).pools.get('iceRink')!;
    expect(rink.active[0]).toBe(true);
    const base = new THREE.Matrix4();
    rink.mesh.getMatrixAt(0, base);
    const inverse = base.clone().invert();
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const next = new THREE.Vector3();
    for (let t = 0; t < 24; t += 2) {
      props.animate(t);
      for (const part of rink.parts) {
        part.mesh.getMatrixAt(0, matrix);
        matrix.premultiply(inverse);
        position.setFromMatrixPosition(matrix);
        expect(position.y).toBeCloseTo(0.23, 4);
        expect((position.x / 11) ** 2 + (position.z / 7.7) ** 2).toBeLessThan(1);
        const forward = new THREE.Vector3(0, 0, -1).transformDirection(matrix);
        props.animate(t + 0.01);
        part.mesh.getMatrixAt(0, matrix);
        next.setFromMatrixPosition(matrix.premultiply(inverse));
        expect(next.sub(position).normalize().dot(forward)).toBeGreaterThan(0.99);
        props.animate(t);
      }
    }
  });

  it('winter traffic collision widths include the blade and wheels', () => {
    const geometries = buildTrafficGeometries(['snowplow', 'skiPickup']);
    for (const [kind, variants] of geometries) for (const geometry of variants) {
      geometry.computeBoundingBox();
      expect(geometry.boundingBox!.max.x).toBeLessThanOrEqual(HALF_WIDTH[kind]);
      expect(-geometry.boundingBox!.min.x).toBeLessThanOrEqual(HALF_WIDTH[kind]);
      geometry.dispose();
    }
    expect(SPEED_FACTOR.snowplow).toBeLessThan(1);
  });
});

describe('Snowfall', () => {
  it('falls, freezes without simulation time, and reuses a bounded pool during long drives', () => {
    const snow = new Snowfall(240, 1.5);
    const attribute = snow.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = attribute.array as Float32Array;
    const initial = positions.slice();
    snow.update(0, new THREE.Vector3());
    expect(positions).toEqual(initial);
    snow.update(0.1, new THREE.Vector3());
    expect(positions[1]).toBeLessThan(initial[1]);
    const falling = positions.slice();
    snow.update(0, new THREE.Vector3());
    expect(positions).toEqual(falling);
    for (let i = 1; i <= 100; i++) snow.update(0.5, new THREE.Vector3(Math.sin(i) * 30, 0, -i * 100));
    expect(attribute.array).toBe(positions);
    expect(attribute.count).toBe(240);
    for (let i = 0; i < attribute.count; i++) {
      expect(Math.abs(attribute.getX(i))).toBeLessThanOrEqual(40);
      expect(Math.abs(attribute.getZ(i))).toBeLessThanOrEqual(65);
      expect(attribute.getY(i)).toBeGreaterThanOrEqual(0.5);
      expect(attribute.getY(i)).toBeLessThanOrEqual(26.5);
    }
    expect(snow.points.position.z).toBe(-10000);
    snow.points.geometry.dispose();
    snow.points.material.map!.dispose();
    snow.points.material.dispose();
  });

  it('rejects snow settings that would create an unbounded pool', () => {
    expect(validatePreset({ ...getPreset('winter'), snowfall: { count: 100000, speed: 1 } }).join()).toContain('snowfall');
  });
});
