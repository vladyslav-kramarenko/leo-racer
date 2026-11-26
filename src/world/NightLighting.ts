import * as THREE from 'three';
import { CONFIG } from '../game/config';
import { buildColoredGeometry, type ColoredPart } from './geometry';
import type { NightPreset, PropsPreset } from './presets/types';
import { createRng } from './random';
import type { RoadGenerator } from './RoadGenerator';

/** Fixed pools of lamp light and a sky that follows the player; no shadows or post-processing. */
export class NightLighting {
  readonly group = new THREE.Group();
  readonly sky = new THREE.Group();
  private readonly pools: THREE.InstancedMesh;
  private readonly lamps: THREE.Vector3[];
  private readonly lights: THREE.PointLight[];
  private readonly headlights: THREE.SpotLight;
  private readonly nearest = [0, 0];
  private readonly distances = [Infinity, Infinity];
  private readonly matrix = new THREE.Matrix4();
  private readonly point = { x: 0, z: 0 };

  constructor(private readonly road: RoadGenerator, private readonly props: PropsPreset,
    cfg: NightPreset, slots: number) {
    this.group.name = 'night-lighting';
    const glow = glowTexture();
    this.pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(12, 17).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glow, color: cfg.lampColor, transparent: true, opacity: 0.12,
        blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
        polygonOffsetUnits: -4 }), slots * props.shoulderCones);
    this.pools.frustumCulled = false;
    this.pools.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.lamps = Array.from({ length: this.pools.count }, () => new THREE.Vector3());
    this.lights = Array.from({ length: 2 }, () => new THREE.PointLight(cfg.lampColor, 22, 24, 1.5));
    this.headlights = new THREE.SpotLight('#fff1ce', 38, 48, 0.5, 0.75, 1.4);
    this.group.add(this.pools, ...this.lights, this.headlights, this.headlights.target, this.sky);

    const rng = createRng(91);
    const positions = new Float32Array(cfg.stars * 3);
    const radius = CONFIG.camera.far * 0.86;
    for (let i = 0; i < cfg.stars; i++) {
      const angle = rng() * Math.PI * 2;
      const height = 0.22 + rng() * 0.73;
      const horizontal = Math.sqrt(1 - height * height) * radius;
      positions.set([Math.cos(angle) * horizontal, height * radius, Math.sin(angle) * horizontal], i * 3);
    }
    const stars = new THREE.BufferGeometry();
    stars.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.sky.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: '#c9dcff', size: 0.65,
      sizeAttenuation: true, fog: false })));
    const moon = new THREE.Mesh(new THREE.CircleGeometry(7, 32), new THREE.MeshBasicMaterial({ color: cfg.moonColor, fog: false }));
    moon.position.set(-64, 53, -179);
    moon.lookAt(0, 0, 0);
    const craters: ColoredPart[] = [];
    for (const [x, y, r] of [[-2, 2, 1.2], [2.3, -1, 1.5], [-2.5, -2.5, 0.75]]) {
      craters.push({ geometry: new THREE.CircleGeometry(r, 12), color: '#dacaab', position: [x, y, 0.02] });
    }
    moon.add(new THREE.Mesh(buildColoredGeometry(craters), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: cfg.moonColor, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.scale.set(38, 38, 1);
    halo.position.copy(moon.position);
    this.sky.add(halo, moon);
  }

  assign(slot: number, chunkIndex: number): void {
    const side = chunkIndex % 2 === 0 ? 1 : -1;
    const offset = side * (CONFIG.road.halfWidth + CONFIG.road.shoulderWidth + (this.props.shoulderDistance ?? -1.6) - 1.2);
    for (let i = 0; i < this.props.shoulderCones; i++) {
      const s = (chunkIndex + (i + 0.5) / this.props.shoulderCones) * CONFIG.world.chunkLength;
      const frame = this.road.frame(s);
      this.road.point(s, offset, this.point);
      const index = slot * this.props.shoulderCones + i;
      this.lamps[index].set(this.point.x, 4.32, this.point.z);
      this.matrix.makeRotationY(-frame.heading);
      this.matrix.setPosition(this.point.x, 0.18, this.point.z);
      this.pools.setMatrixAt(index, this.matrix);
    }
    this.pools.instanceMatrix.needsUpdate = true;
  }

  update(progress: number, focus: THREE.Vector3): void {
    this.sky.position.copy(focus);
    this.distances.fill(Infinity);
    for (let i = 0; i < this.lamps.length; i++) {
      const distance = this.lamps[i].distanceToSquared(focus);
      if (distance < this.distances[0]) {
        this.distances[1] = this.distances[0]; this.nearest[1] = this.nearest[0];
        this.distances[0] = distance; this.nearest[0] = i;
      } else if (distance < this.distances[1]) {
        this.distances[1] = distance; this.nearest[1] = i;
      }
    }
    for (let i = 0; i < this.lights.length; i++) {
      this.lights[i].visible = Number.isFinite(this.distances[i]);
      if (this.lights[i].visible) this.lights[i].position.copy(this.lamps[this.nearest[i]]);
    }
    const frame = this.road.frame(progress);
    this.headlights.position.set(focus.x + frame.fx * 4, 1.4, focus.z + frame.fz * 4);
    this.road.point(progress + 28, 0, this.point);
    this.headlights.target.position.set(this.point.x, 0, this.point.z);
  }
}

/** Soft radial falloff for the road pools and moon halo, without canvas or external assets. */
function glowTexture(): THREE.DataTexture {
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1);
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.round(255 * Math.pow(Math.max(0, 1 - radius), 2));
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
