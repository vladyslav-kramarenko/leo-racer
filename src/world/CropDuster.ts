import * as THREE from 'three';
import { biplaneModel } from './biplaneModel';
import type { FlypastPreset } from './presets/types';
import { RoadFlypast } from './RoadFlypast';
import type { RoadGenerator } from './RoadGenerator';

/** A single pooled farm biplane with a continuously turning propeller. */
export class CropDuster {
  readonly group: THREE.Group;
  private readonly flight: RoadFlypast;
  private readonly propeller: THREE.Mesh;

  constructor(road: RoadGenerator, cfg: FlypastPreset, rng: () => number = Math.random) {
    this.flight = new RoadFlypast(road, cfg, { firstDelay: 5, duration: 14, halfWidth: 150, ahead: 80, forwardRatio: 1.15 }, rng);
    this.group = this.flight.group;
    this.group.name = 'farm-crop-duster';
    this.group.scale.setScalar(1.3);
    const model = biplaneModel();
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.propeller = new THREE.Mesh(model.propeller, material);
    this.propeller.name = 'biplane-propeller';
    this.propeller.position.set(0, 0, -3.6);
    this.group.add(new THREE.Mesh(model.body, material), this.propeller);
  }

  isFlying(): boolean { return this.flight.isFlying(); }

  update(dt: number, progress: number): void {
    if (dt <= 0) return;
    this.flight.update(dt, progress);
    if (this.flight.isFlying()) this.propeller.rotation.z = (this.propeller.rotation.z + dt * 7.5) % (Math.PI * 2);
  }
}
