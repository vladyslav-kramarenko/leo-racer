import * as THREE from 'three';
import { CONFIG } from '../game/config';
import { cabooseGeometry, driverWheelGeometry, locomotiveGeometry, oreWagonGeometry, tenderGeometry, trackGeometry } from './freightModels';
import { box, buildColoredGeometry, ico } from './geometry';
import type { FreightRailwayPreset } from './presets/types';
import type { RoadGenerator } from './RoadGenerator';

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const WAGON_SPACING = 7.8;

/** Pooled ground-level railway following the road, with occasional steam freight. */
export class FreightRailway {
  readonly group = new THREE.Group();
  private readonly track: THREE.InstancedMesh;
  private readonly engine: THREE.InstancedMesh;
  private readonly tender: THREE.InstancedMesh;
  private readonly wagons: THREE.InstancedMesh;
  private readonly caboose: THREE.InstancedMesh;
  private readonly wheels: THREE.InstancedMesh;
  private readonly rods: THREE.InstancedMesh;
  private readonly steam: THREE.InstancedMesh;
  private readonly sectionsPerChunk = 8;
  private lead: number | null = null;
  private direction = -1;
  private nextTrainIn = 3;
  private time = 0;
  private wheelAngle = 0;
  private readonly matrix = new THREE.Matrix4();
  private readonly engineMatrix = new THREE.Matrix4();
  private readonly local = new THREE.Matrix4();
  private readonly rotation = new THREE.Quaternion();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly xAxis = new THREE.Vector3(1, 0, 0);
  private readonly point = { x: 0, z: 0 };

  constructor(private readonly road: RoadGenerator, private readonly cfg: FreightRailwayPreset,
    slots: number, private readonly rng: () => number = Math.random) {
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const mesh = (geometry: THREE.BufferGeometry, count: number, mat: THREE.Material = material) => {
      const instances = new THREE.InstancedMesh(geometry, mat, count);
      instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      instances.frustumCulled = false;
      this.group.add(instances);
      return instances;
    };
    this.group.name = 'steam-freight-railway';
    this.track = mesh(trackGeometry(CONFIG.world.chunkLength / this.sectionsPerChunk), slots * this.sectionsPerChunk);
    this.engine = mesh(locomotiveGeometry(), 1);
    this.tender = mesh(tenderGeometry(), 1);
    this.wagons = mesh(oreWagonGeometry(), cfg.wagons);
    this.caboose = mesh(cabooseGeometry(), 1);
    this.wheels = mesh(driverWheelGeometry(), 8);
    this.rods = mesh(buildColoredGeometry([{ geometry: box(0.15, 0.14, 5.1), color: '#e0c989' }]), 2);
    this.steam = mesh(ico(1, 1), 8, new THREE.MeshLambertMaterial({ color: '#eaf0ef', transparent: true, opacity: 0.65, depthWrite: false }));
    this.hideTrain();
  }

  assign(slot: number, chunkIndex: number): void {
    const length = CONFIG.world.chunkLength / this.sectionsPerChunk;
    for (let section = 0; section < this.sectionsPerChunk; section++) {
      const s = chunkIndex * CONFIG.world.chunkLength + (section + 0.5) * length;
      this.pose(s, 1);
      this.track.setMatrixAt(slot * this.sectionsPerChunk + section, this.matrix);
    }
    this.track.instanceMatrix.needsUpdate = true;
  }

  isTrainRunning(): boolean { return this.lead !== null; }

  update(dt: number, progress: number): void {
    if (dt <= 0) return;
    this.time += dt;
    if (this.lead === null) {
      this.nextTrainIn -= dt;
      if (this.nextTrainIn > 0) return;
      this.lead = progress + (this.direction < 0 ? 170 : -20);
    }
    this.lead += this.direction * this.cfg.speed * dt;
    const tailDistance = 8.5 + (this.cfg.wagons + 1) * WAGON_SPACING;
    const tail = this.lead - this.direction * tailDistance;
    const firstChunk = Math.floor(progress / CONFIG.world.chunkLength) - CONFIG.world.chunksBehind;
    const min = firstChunk * CONFIG.world.chunkLength;
    const max = (firstChunk + CONFIG.world.chunksBehind + CONFIG.world.chunksAhead + 1) * CONFIG.world.chunkLength;
    if (Math.min(this.lead, tail) > max + 10 || Math.max(this.lead, tail) < min - 10) {
      this.lead = null;
      this.direction *= -1;
      this.hideTrain();
      const [low, high] = this.cfg.intervalSec;
      this.nextTrainIn = low + this.rng() * (high - low);
      return;
    }
    const place = (mesh: THREE.InstancedMesh, index: number, distance: number) => {
      const s = this.lead! - this.direction * distance;
      this.pose(s, this.direction, 0.44);
      if (s < min || s > max) this.matrix.copy(ZERO);
      mesh.setMatrixAt(index, this.matrix);
      mesh.instanceMatrix.needsUpdate = true;
    };
    place(this.engine, 0, 0);
    this.engineMatrix.copy(this.matrix);
    place(this.tender, 0, 8.5);
    for (let i = 0; i < this.cfg.wagons; i++) place(this.wagons, i, 8.5 + (i + 1) * WAGON_SPACING);
    place(this.caboose, 0, tailDistance);
    this.wheelAngle -= this.cfg.speed * dt / 0.78;
    for (let i = 0; i < 8; i++) {
      this.position.set(i < 4 ? -1.3 : 1.3, 0.78, -2.4 + (i % 4) * 1.6);
      this.rotation.setFromAxisAngle(this.xAxis, this.wheelAngle);
      this.scale.setScalar(1);
      this.local.compose(this.position, this.rotation, this.scale);
      this.matrix.multiplyMatrices(this.engineMatrix, this.local);
      this.wheels.setMatrixAt(i, this.matrix);
    }
    for (let i = 0; i < 2; i++) {
      this.local.makeTranslation(i ? 1.52 : -1.52, 0.78 + Math.cos(this.wheelAngle) * 0.35, Math.sin(this.wheelAngle) * 0.35);
      this.matrix.multiplyMatrices(this.engineMatrix, this.local);
      this.rods.setMatrixAt(i, this.matrix);
    }
    for (let i = 0; i < 8; i++) {
      const age = (this.time * 0.55 + i / 8) % 1;
      this.position.set(Math.sin(i * 2.1) * age * 0.7, 4 + age * 4, -3 + age * 5);
      this.rotation.identity();
      this.scale.setScalar((0.3 + age) * Math.min(1, (1 - age) * 8));
      this.local.compose(this.position, this.rotation, this.scale);
      this.matrix.multiplyMatrices(this.engineMatrix, this.local);
      this.steam.setMatrixAt(i, this.matrix);
    }
    for (const mesh of [this.wheels, this.rods, this.steam]) mesh.instanceMatrix.needsUpdate = true;
  }

  private pose(s: number, direction: number, y = 0): void {
    const frame = this.road.frame(s);
    this.road.point(s, this.cfg.offset, this.point);
    this.rotation.setFromAxisAngle(this.up, -frame.heading + (direction < 0 ? Math.PI : 0));
    this.position.set(this.point.x, y, this.point.z);
    this.scale.setScalar(1);
    this.matrix.compose(this.position, this.rotation, this.scale);
  }

  private hideTrain(): void {
    for (const mesh of [this.engine, this.tender, this.wagons, this.caboose, this.wheels, this.rods, this.steam]) {
      for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, ZERO);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
