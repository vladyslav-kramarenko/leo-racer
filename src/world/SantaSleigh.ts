import * as THREE from 'three';
import type { WorldPreset } from './presets/types';
import type { RoadFrame, RoadGenerator } from './RoadGenerator';
import { santaSleighModel } from './santaModels';

const FLIGHT_SECONDS = 12;
const CROSSING_HALF_WIDTH = 72;

/** One reusable sleigh follows a preplanned diagonal flypast, alternating directions. */
export class SantaSleigh {
  readonly group = new THREE.Group();
  private readonly arm: THREE.Mesh;
  private readonly legs: THREE.InstancedMesh;
  private readonly legPivots: THREE.Vector3[];
  private readonly matrix = new THREE.Matrix4();
  private frame: RoadFrame | null = null;
  private startS = 0;
  private forwardSpeed = 0;
  private age: number | null = null;
  private direction = 1;
  private nextFlightIn = 4;
  private previousProgress = 0;
  private time = 0;

  constructor(private readonly road: RoadGenerator, private readonly cfg: NonNullable<WorldPreset['santaSleigh']>,
    private readonly rng: () => number = Math.random) {
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

  isFlying(): boolean { return this.age !== null; }

  update(dt: number, progress: number): void {
    if (dt <= 0) return;
    this.time += dt;
    const speed = Math.max(0, Math.min(50, (progress - this.previousProgress) / dt));
    this.previousProgress = progress;
    if (this.age === null) {
      this.nextFlightIn -= dt;
      if (this.nextFlightIn > 0) return;
      // Predict where the bus will be at mid-flight so the crossing stays visible
      // both at cruising speed and with the accelerator held. The flight itself is fixed in world space.
      this.forwardSpeed = speed * 0.65;
      this.startS = progress + (speed - this.forwardSpeed) * FLIGHT_SECONDS / 2 + 110;
      this.frame = this.road.frame(this.startS);
      this.age = 0;
      this.group.visible = true;
    } else this.age += dt;
    if (this.age >= FLIGHT_SECONDS) {
      this.age = null;
      this.group.visible = false;
      this.direction *= -1;
      const [low, high] = this.cfg.intervalSec;
      this.nextFlightIn = low + this.rng() * (high - low);
      return;
    }
    const f = this.age / FLIGHT_SECONDS;
    const lateral = this.direction * CROSSING_HALF_WIDTH * (2 * f - 1);
    const frame = this.road.frame(this.startS + this.forwardSpeed * this.age, this.frame!);
    this.group.position.set(frame.x + frame.rx * lateral, this.cfg.altitude + Math.sin(f * Math.PI) * 1.2, frame.z + frame.rz * lateral);
    this.group.rotation.set(0, -this.direction * Math.atan2(2 * CROSSING_HALF_WIDTH / FLIGHT_SECONDS, this.forwardSpeed)
      - frame.heading, Math.sin(f * Math.PI * 2) * 0.025);
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
