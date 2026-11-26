import * as THREE from 'three';
import type { WorldPreset } from './presets/types';
import type { RoadGenerator } from './RoadGenerator';
import { RoadFlypast } from './RoadFlypast';
import { santaSleighModel } from './santaModels';

/** One reusable sleigh follows a preplanned diagonal flypast, alternating directions. */
export class SantaSleigh {
  readonly group: THREE.Group;
  private readonly flight: RoadFlypast;
  private readonly arm: THREE.Mesh;
  private readonly legs: THREE.InstancedMesh;
  private readonly legPivots: THREE.Vector3[];
  private readonly matrix = new THREE.Matrix4();
  private time = 0;

  constructor(road: RoadGenerator, cfg: NonNullable<WorldPreset['santaSleigh']>, rng: () => number = Math.random) {
    this.flight = new RoadFlypast(road, cfg, { firstDelay: 4, duration: 12, halfWidth: 72, ahead: 110, forwardRatio: 0.65 }, rng);
    this.group = this.flight.group;
    const model = santaSleighModel();
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.arm = new THREE.Mesh(model.arm, material);
    this.arm.position.set(0.62, 2.38, -0.55);
    this.legPivots = model.legPivots;
    this.legs = new THREE.InstancedMesh(model.leg, material, model.legPivots.length);
    this.legs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.legs.frustumCulled = false;
    this.group.add(new THREE.Mesh(model.body, material), this.arm, this.legs);
    this.group.name = 'santa-sleigh';
    this.group.scale.setScalar(1.8);
    this.group.visible = false;
  }

  isFlying(): boolean { return this.flight.isFlying(); }

  update(dt: number, progress: number): void {
    if (dt <= 0) return;
    this.time += dt;
    this.flight.update(dt, progress);
    if (!this.flight.isFlying()) return;
    this.arm.rotation.z = -0.25 + Math.sin(this.time * 3.8) * 0.3;
    for (let i = 0; i < this.legPivots.length; i++) {
      const phase = Math.floor(i / 4) * 0.7 + (i % 2) * Math.PI;
      this.matrix.makeRotationX(-0.35 + Math.sin(this.time * 5 + phase) * 0.55);
      this.matrix.setPosition(this.legPivots[i]);
      this.legs.setMatrixAt(i, this.matrix);
    }
    this.legs.instanceMatrix.needsUpdate = true;
  }
}
