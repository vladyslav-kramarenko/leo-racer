import * as THREE from 'three';
import { CONFIG } from '../game/config';
import { makeCanvas } from './geometry';
import type { GroundBand, RoadPreset } from './presets/types';
import type { RoadGenerator } from './RoadGenerator';

interface RoadChunk {
  /** Chunk index along the road (chunk covers [index*L, (index+1)*L)). */
  index: number;
  slot: number;
  mesh: THREE.Mesh;
  positions: THREE.BufferAttribute;
  uvs: THREE.BufferAttribute;
  /** Optional coloured strips beside the road (water, fields, sidewalks). */
  bands: { mesh: THREE.Mesh; positions: THREE.BufferAttribute } | null;
}

/** One strip per band and side, expanded from the preset. `inner` is always the more-left offset. */
interface BandStrip {
  inner: number;
  outer: number;
  y: number;
  color: THREE.Color;
}

export type ChunkListener = (slot: number, index: number) => void;

/**
 * Fixed pool of road chunks. When the bus passes a chunk, that chunk is moved
 * ahead and its geometry rewritten in place — no new Three.js objects are created.
 */
export class ChunkManager {
  readonly group = new THREE.Group();
  private readonly chunks: RoadChunk[] = [];
  private readonly material: THREE.MeshLambertMaterial;
  private readonly listeners: ChunkListener[] = [];
  private readonly segs = CONFIG.world.segmentsPerChunk;
  private readonly length = CONFIG.world.chunkLength;
  private readonly halfTotal = CONFIG.road.halfWidth + CONFIG.road.shoulderWidth;
  private readonly strips: BandStrip[];
  private readonly bandMaterial = new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    // Pull bands towards the camera so they never z-fight with the terrain far away.
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  constructor(
    private readonly road: RoadGenerator,
    preset: RoadPreset,
    bands: readonly GroundBand[] = [],
  ) {
    const texture = createRoadTexture(preset);
    this.material = new THREE.MeshLambertMaterial({ map: texture });
    this.strips = expandBands(bands);

    const poolSize = CONFIG.world.chunksAhead + CONFIG.world.chunksBehind + 1;
    for (let slot = 0; slot < poolSize; slot++) {
      const chunk = this.createChunk(slot);
      this.chunks.push(chunk);
      this.group.add(chunk.mesh);
      if (chunk.bands) this.group.add(chunk.bands.mesh);
    }
  }

  get poolSize(): number {
    return this.chunks.length;
  }

  onChunkAssigned(listener: ChunkListener): void {
    this.listeners.push(listener);
  }

  /** Initial layout; call after listeners are registered. */
  reset(progress: number): void {
    const first = Math.floor(progress / this.length) - CONFIG.world.chunksBehind;
    this.chunks.forEach((chunk, i) => this.assign(chunk, first + i));
  }

  update(progress: number): void {
    const current = Math.floor(progress / this.length);
    const min = current - CONFIG.world.chunksBehind;
    const max = current + CONFIG.world.chunksAhead;
    const present = new Set(this.chunks.map((c) => c.index));
    for (const chunk of this.chunks) {
      if (chunk.index >= min && chunk.index <= max) continue;
      for (let idx = min; idx <= max; idx++) {
        if (!present.has(idx)) {
          present.delete(chunk.index);
          present.add(idx);
          this.assign(chunk, idx);
          break;
        }
      }
    }
  }

  activeIndices(): number[] {
    return this.chunks.map((c) => c.index).sort((a, b) => a - b);
  }

  private createChunk(slot: number): RoadChunk {
    const rows = this.segs + 1;
    const geometry = new THREE.BufferGeometry();
    const positions = new THREE.BufferAttribute(new Float32Array(rows * 2 * 3), 3);
    const normals = new THREE.BufferAttribute(new Float32Array(rows * 2 * 3), 3);
    const uvs = new THREE.BufferAttribute(new Float32Array(rows * 2 * 2), 2);
    for (let i = 0; i < rows * 2; i++) normals.setXYZ(i, 0, 1, 0);
    const index: number[] = [];
    for (let i = 0; i < this.segs; i++) {
      const l = i * 2;
      const r = l + 1;
      const l1 = l + 2;
      const r1 = l + 3;
      index.push(l, r, l1, r, r1, l1);
    }
    positions.setUsage(THREE.DynamicDrawUsage);
    uvs.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', positions);
    geometry.setAttribute('normal', normals);
    geometry.setAttribute('uv', uvs);
    geometry.setIndex(index);
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.matrixAutoUpdate = false;
    return { index: Number.NaN, slot, mesh, positions, uvs, bands: this.createBands() };
  }

  /** Strips are quads between an inner and outer offset; one strip-row per segment. */
  private createBands(): RoadChunk['bands'] {
    if (!this.strips.length) return null;
    const rows = this.segs + 1;
    const vertsPerStrip = rows * 2;
    const total = vertsPerStrip * this.strips.length;
    const geometry = new THREE.BufferGeometry();
    const positions = new THREE.BufferAttribute(new Float32Array(total * 3), 3);
    const normals = new THREE.BufferAttribute(new Float32Array(total * 3), 3);
    const colors = new THREE.BufferAttribute(new Float32Array(total * 3), 3);
    const index: number[] = [];
    this.strips.forEach((strip, k) => {
      const base = k * vertsPerStrip;
      for (let i = 0; i < vertsPerStrip; i++) {
        normals.setXYZ(base + i, 0, 1, 0);
        colors.setXYZ(base + i, strip.color.r, strip.color.g, strip.color.b);
      }
      for (let i = 0; i < this.segs; i++) {
        const a = base + i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
    positions.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', positions);
    geometry.setAttribute('normal', normals);
    geometry.setAttribute('color', colors);
    geometry.setIndex(index);
    const mesh = new THREE.Mesh(geometry, this.bandMaterial);
    mesh.matrixAutoUpdate = false;
    return { mesh, positions };
  }

  /**
   * On the inside of a curve, offsets beyond the curve radius fold the strip over itself
   * (dark, inside-out triangles). Clamp them just short of the radius.
   */
  private safeOffset(s: number, d: number): number {
    const k = this.road.curvature(s);
    if (Math.sign(d) !== Math.sign(k) || k === 0) return d;
    const max = 0.85 / Math.abs(k);
    return Math.abs(d) > max ? Math.sign(d) * max : d;
  }

  private assign(chunk: RoadChunk, index: number): void {
    chunk.index = index;
    const s0 = index * this.length;
    const texLen = CONFIG.road.textureLength;
    const vOffset = ((s0 / texLen) % 1 + 1) % 1;
    const p = { x: 0, z: 0 };
    for (let i = 0; i <= this.segs; i++) {
      const s = s0 + (i / this.segs) * this.length;
      const v = vOffset + (s - s0) / texLen;
      this.road.point(s, -this.halfTotal, p);
      chunk.positions.setXYZ(i * 2, p.x, 0.02, p.z);
      chunk.uvs.setXY(i * 2, 0, v);
      this.road.point(s, this.halfTotal, p);
      chunk.positions.setXYZ(i * 2 + 1, p.x, 0.02, p.z);
      chunk.uvs.setXY(i * 2 + 1, 1, v);
    }
    chunk.positions.needsUpdate = true;
    chunk.uvs.needsUpdate = true;
    chunk.mesh.geometry.computeBoundingSphere();

    if (chunk.bands) {
      const rows = this.segs + 1;
      this.strips.forEach((strip, k) => {
        const base = k * rows * 2;
        for (let i = 0; i <= this.segs; i++) {
          const s = s0 + (i / this.segs) * this.length;
          this.road.point(s, this.safeOffset(s, strip.inner), p);
          chunk.bands!.positions.setXYZ(base + i * 2, p.x, strip.y, p.z);
          this.road.point(s, this.safeOffset(s, strip.outer), p);
          chunk.bands!.positions.setXYZ(base + i * 2 + 1, p.x, strip.y, p.z);
        }
      });
      chunk.bands.positions.needsUpdate = true;
      chunk.bands.mesh.geometry.computeBoundingSphere();
    }
    for (const listener of this.listeners) listener(chunk.slot, index);
  }
}

function createRoadTexture(preset: RoadPreset): THREE.Texture {
  const W = 256;
  const H = 512;
  const { canvas, ctx } = makeCanvas(W, H);
  const total = (CONFIG.road.halfWidth + CONFIG.road.shoulderWidth) * 2;
  const px = (m: number) => (m / total) * W;
  const shoulder = px(CONFIG.road.shoulderWidth);

  ctx.fillStyle = preset.shoulder;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = preset.asphalt;
  ctx.fillRect(shoulder, 0, W - shoulder * 2, H);

  // Speckles for a bit of texture.
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const onAsphalt = x > shoulder && x < W - shoulder;
    ctx.fillStyle = onAsphalt ? preset.asphaltSpeckle : 'rgba(120,100,80,0.35)';
    ctx.fillRect(x, y, 2, 2);
  }

  const line = Math.max(3, px(0.18));
  if (preset.edgeLine) {
    ctx.fillStyle = preset.edgeLine;
    ctx.fillRect(shoulder + px(0.25), 0, line, H);
    ctx.fillRect(W - shoulder - px(0.25) - line, 0, line, H);
  }

  // Two dashes per texture repeat.
  if (preset.centerLine) {
    ctx.fillStyle = preset.centerLine;
    const dash = H / 4;
    for (let y = 0; y < H; y += dash * 2) ctx.fillRect(W / 2 - line / 2, y, line, dash);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function expandBands(bands: readonly GroundBand[]): BandStrip[] {
  const strips: BandStrip[] = [];
  for (const band of bands) {
    const color = new THREE.Color(band.color);
    const y = band.y ?? 0.01;
    // Vertices go left→right (more negative offset first) so faces point up and are lit.
    if (band.side !== 'left') strips.push({ inner: band.from, outer: band.to, y, color });
    if (band.side !== 'right') strips.push({ inner: -band.to, outer: -band.from, y, color });
  }
  return strips;
}
