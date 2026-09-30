import * as THREE from 'three';
import { CONFIG } from '../game/config';
import { ChunkManager } from './ChunkManager';
import { buildColoredGeometry, cone, makeCanvas } from './geometry';
import { ObjectSpawner } from './ObjectSpawner';
import type { SkyPreset, TerrainPreset, WorldPreset } from './presets/types';
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
    this.hills = createHills(preset.sky);
    this.terrainTexture = createTerrainTexture(preset.terrain);
    const size = CONFIG.world.terrainSize;
    this.terrainTexture.repeat.set(size / this.terrainTile, size / this.terrainTile);
    this.terrain = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshLambertMaterial({ map: this.terrainTexture }),
    );
    this.terrain.rotation.x = -Math.PI / 2;
    this.group.add(this.sky, this.hills, this.terrain);

    this.chunks = new ChunkManager(this.road, preset.road);
    this.props = new ObjectSpawner(this.road, preset.props, this.chunks.poolSize);
    this.chunks.onChunkAssigned((slot, index) => this.props.populate(slot, index));
    this.chunks.reset(0);
    this.group.add(this.chunks.group, this.props.group);
    scene.add(this.group);
  }

  /** Keep the endless world centred around the vehicle. */
  update(progress: number, focus: THREE.Vector3): void {
    this.chunks.update(progress);

    // Terrain follows the vehicle while its texture stays fixed in world space.
    this.terrain.position.set(focus.x, 0, focus.z);
    this.terrainTexture.offset.set(focus.x / this.terrainTile, -focus.z / this.terrainTile);

    this.sky.position.set(focus.x, 0, focus.z);
    this.hills.position.set(focus.x, 0, focus.z);
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

/** A ring of soft green hills on the horizon; follows the vehicle so it never gets closer. */
function createHills(sky: SkyPreset): THREE.Mesh {
  const rng = createRng(42);
  const parts: Parameters<typeof buildColoredGeometry>[0] = [];
  const radius = CONFIG.camera.far * 0.75;
  for (let i = 0; i < 46; i++) {
    const angle = (i / 46) * Math.PI * 2 + rng() * 0.08;
    const r = radius + rng() * 12;
    const h = 14 + rng() * 22;
    const w = 26 + rng() * 26;
    parts.push({
      geometry: cone(w, h, 7),
      color: sky.hillColors[i % sky.hillColors.length],
      position: [Math.cos(angle) * r, h / 2 - 1, Math.sin(angle) * r],
      rotation: [0, rng() * Math.PI, 0],
    });
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
