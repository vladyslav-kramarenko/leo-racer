import * as THREE from 'three';
import { CONFIG } from '../game/config';
import { ChunkManager } from './ChunkManager';
import { Guideway } from './Guideway';
import { FreightRailway } from './FreightRailway';
import { Snowfall } from './Snowfall';
import { applyGroundCutouts } from './groundCutouts';
import { box, buildColoredGeometry, cone, makeCanvas, rbox } from './geometry';
import { ObjectSpawner } from './ObjectSpawner';
import type { HillsPreset, SkylinePreset, SkyPreset, TerrainPreset, WorldPreset } from './presets/types';
import { createRng } from './random';
import { RoadGenerator } from './RoadGenerator';

/**
 * Builds a world from a preset: sky, lights, terrain, endless road and props.
 * Knows nothing about input devices or drawings.
 */
export class WorldManager {
  readonly group = new THREE.Group();
  readonly road: RoadGenerator;
  readonly chunks: ChunkManager;
  readonly props: ObjectSpawner;
  private readonly terrain: THREE.Mesh;
  private readonly terrainTexture: THREE.Texture;
  private readonly sky: THREE.Mesh;
  private readonly hills: THREE.Mesh;
  private readonly skyline: THREE.Mesh | null;
  readonly guideway: Guideway | null;
  readonly freightRailway: FreightRailway | null;
  readonly snowfall: Snowfall | null;
  private readonly sun: THREE.DirectionalLight;
  private readonly terrainTile = 24;

  constructor(
    readonly preset: WorldPreset,
    scene: THREE.Scene,
  ) {
    this.road = new RoadGenerator(preset.road.curve);

    scene.fog = new THREE.Fog(preset.sky.fogColor, preset.sky.fogNear, preset.sky.fogFar);
    scene.background = new THREE.Color(preset.sky.horizon);

    const hemi = new THREE.HemisphereLight(preset.sky.hemiSky, preset.sky.hemiGround, preset.sky.hemiIntensity);
    this.sun = new THREE.DirectionalLight(preset.sky.sunColor, preset.sky.sunIntensity);
    this.sun.position.set(-40, 80, 30);
    this.group.add(hemi, this.sun, this.sun.target);

    this.sky = createSkyDome(preset.sky);
    this.hills = createHills(preset.sky.hills);
    this.skyline = preset.sky.skyline ? createSkyline(preset.sky.skyline) : null;
    if (this.skyline) this.group.add(this.skyline);
    this.terrainTexture = createTerrainTexture(preset.terrain);
    const size = CONFIG.world.terrainSize;
    this.terrainTexture.repeat.set(size / this.terrainTile, size / this.terrainTile);
    this.terrain = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshLambertMaterial({ map: this.terrainTexture }),
    );
    this.terrain.rotation.x = -Math.PI / 2;
    this.group.add(this.sky, this.hills, this.terrain);

    this.chunks = new ChunkManager(this.road, preset.road, preset.terrain.bands);
    this.props = new ObjectSpawner(this.road, preset.props, this.chunks.poolSize);
    applyGroundCutouts(this.terrain.material as THREE.MeshLambertMaterial, this.props.groundCutouts, this.props.groundCutoutRotations);
    this.chunks.onChunkAssigned((slot, index) => this.props.populate(slot, index));
    this.guideway = preset.guideway ? new Guideway(this.road, preset.guideway, this.chunks.poolSize) : null;
    if (this.guideway) {
      const guideway = this.guideway;
      this.chunks.onChunkAssigned((slot, index) => guideway.assign(slot, index));
      this.group.add(guideway.group);
    }
    this.freightRailway = preset.freightRailway ? new FreightRailway(this.road, preset.freightRailway, this.chunks.poolSize) : null;
    if (this.freightRailway) {
      const railway = this.freightRailway;
      this.chunks.onChunkAssigned((slot, index) => railway.assign(slot, index));
      this.group.add(railway.group);
    }
    this.chunks.reset(0);
    this.snowfall = preset.snowfall ? new Snowfall(preset.snowfall.count, preset.snowfall.speed) : null;
    if (this.snowfall) this.group.add(this.snowfall.points);
    this.group.add(this.chunks.group, this.props.group);
    scene.add(this.group);
  }

  /** Keep the endless world centred around the vehicle and animate props. */
  update(progress: number, focus: THREE.Vector3, timeSec: number, dt = 0): void {
    this.chunks.update(progress);
    this.props.animate(timeSec);
    this.guideway?.update(dt, progress);
    this.freightRailway?.update(dt, progress);
    this.snowfall?.update(dt, focus);

    // Terrain follows the vehicle while its texture stays fixed in world space.
    this.terrain.position.set(focus.x, 0, focus.z);
    this.terrainTexture.offset.set(focus.x / this.terrainTile, -focus.z / this.terrainTile);

    this.sky.position.set(focus.x, 0, focus.z);
    this.hills.position.set(focus.x, 0, focus.z);
    this.skyline?.position.set(focus.x, 0, focus.z);
    this.sun.position.set(focus.x - 40, 80, focus.z + 30);
    this.sun.target.position.set(focus.x, 0, focus.z);
  }
}

function createSkyDome(sky: SkyPreset): THREE.Mesh {
  const radius = CONFIG.camera.far * 0.9;
  const geometry = new THREE.SphereGeometry(radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const top = new THREE.Color(sky.top);
  const horizon = new THREE.Color(sky.horizon);
  const pos = geometry.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.pow(Math.max(0, pos.getY(i) / radius), 0.6);
    c.copy(horizon).lerp(top, t);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * Distant tower silhouettes in hazy colours (no fog, like the hills). Leaves a gap straight
 * ahead and behind, where the road runs, so no tower stands on the road.
 */
function createSkyline(skyline: SkylinePreset): THREE.Mesh {
  const rng = createRng(17);
  const parts: Parameters<typeof buildColoredGeometry>[0] = [];
  const radius = CONFIG.camera.far * 0.64;
  for (let i = 0; i < skyline.count; i++) {
    const angle = (i / skyline.count) * Math.PI * 2 + rng() * 0.05;
    // Angle 0 / π = along X; the road runs along Z, i.e. at ±π/2.
    const fromRoad = Math.abs(Math.abs(Math.sin(angle)) - 1);
    if (fromRoad < 0.12) continue;
    // The road heads along -Z, so its right-hand side is +X.
    const x0 = Math.cos(angle);
    if ((skyline.side === 'right' && x0 < 0) || (skyline.side === 'left' && x0 > 0)) continue;
    const r = radius + rng() * 18;
    const h = skyline.height[0] + rng() * (skyline.height[1] - skyline.height[0]);
    const w = skyline.width[0] + rng() * (skyline.width[1] - skyline.width[0]);
    const color = skyline.colors[i % skyline.colors.length];
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    parts.push({ geometry: rbox(w, h, w * 0.8, 0.6), color, position: [x, h / 2 - 1, z], rotation: [0, -angle, 0] });
    if (rng() < 0.35) {
      parts.push({ geometry: box(w * 0.5, 3, w * 0.4), color, position: [x, h + 0.5, z], rotation: [0, -angle, 0] });
    }
  }
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false });
  const mesh = new THREE.Mesh(buildColoredGeometry(parts), material);
  mesh.frustumCulled = false;
  return mesh;
}

/** A ring of hills or mountains on the horizon; follows the vehicle so it never gets closer. */
function createHills(hills: HillsPreset): THREE.Mesh {
  const rng = createRng(42);
  const parts: Parameters<typeof buildColoredGeometry>[0] = [];
  const radius = CONFIG.camera.far * 0.75;
  const count = 46;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rng() * 0.08;
    const r = radius + rng() * 12;
    const h = hills.height[0] + rng() * (hills.height[1] - hills.height[0]);
    const w = hills.width[0] + rng() * (hills.width[1] - hills.width[0]);
    const yaw = rng() * Math.PI;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    parts.push({
      geometry: cone(w, h, 7),
      color: hills.colors[i % hills.colors.length],
      position: [x, h / 2 - 1, z],
      rotation: [0, yaw, 0],
    });
    if (hills.snowCap) {
      // The top 30% of the same cone, slightly larger so it sits on the slopes.
      const capH = h * 0.3;
      parts.push({
        geometry: cone(w * 0.3 * 1.04, capH, 7),
        color: hills.snowCap,
        position: [x, h - 1 - capH / 2 + 0.05, z],
        rotation: [0, yaw, 0],
      });
    }
  }
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false });
  const mesh = new THREE.Mesh(buildColoredGeometry(parts), material);
  mesh.frustumCulled = false;
  return mesh;
}

function createTerrainTexture(terrain: TerrainPreset): THREE.Texture {
  const S = 256;
  const { canvas, ctx } = makeCanvas(S, S);
  const rng = createRng(7);
  ctx.fillStyle = terrain.base;
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = terrain.patches[i % terrain.patches.length];
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    const x = rng() * S;
    const y = rng() * S;
    const r = 10 + rng() * 30;
    // Draw wrapped copies so the texture tiles seamlessly.
    for (const [dx, dy] of [
      [0, 0],
      [S, 0],
      [-S, 0],
      [0, S],
      [0, -S],
    ]) {
      ctx.moveTo(x + dx + r, y + dy);
      ctx.ellipse(x + dx, y + dy, r, r * 0.7, rng() * Math.PI, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 2200; i++) {
    ctx.fillStyle = terrain.speckles[i % terrain.speckles.length];
    ctx.fillRect(rng() * S, rng() * S, 2, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
