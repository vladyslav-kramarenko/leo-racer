import * as THREE from 'three';
import { CONFIG } from '../game/config';
import { avoidanceTarget, overlapsBus } from '../world/laneAvoidance';

/** The only thing the sprite layer needs from the world: a road to place things along. */
export interface RoadPath {
  point(s: number, d: number, out?: { x: number; z: number }): { x: number; z: number };
}

export type DrawingFrequency = 'rare' | 'normal' | 'often';

export interface SpriteSource {
  id: string;
  image: Blob;
  moves: boolean;
  frequency?: DrawingFrequency;
}

export type MovementPattern =
  | 'sameDirection'
  | 'oppositeDirection'
  | 'parallelFar'
  | 'crossingFar'
  | 'laneSameDirection'
  | 'laneOppositeDirection';

/** Roadside / far patterns — never on the driving lanes. */
export const ROADSIDE_PATTERNS: readonly MovementPattern[] = ['sameDirection', 'oppositeDirection', 'parallelFar', 'crossingFar'];
/** Real lanes; the drawing makes way when the bus comes close. */
export const LANE_PATTERNS: readonly MovementPattern[] = ['laneSameDirection', 'laneOppositeDirection'];
export const MOVEMENT_PATTERNS: readonly MovementPattern[] = [...ROADSIDE_PATTERNS, ...LANE_PATTERNS];

/** Weighted pick that avoids repeating the previous drawing when there is a choice. */
export function pickWeighted<T extends { id: string; frequency?: DrawingFrequency }>(
  items: readonly T[],
  rng: () => number,
  lastId: string | null,
): T | null {
  const pool = items.length > 1 ? items.filter((i) => i.id !== lastId) : items;
  const weight = (i: T) => CONFIG.drawings.frequencyWeight[i.frequency ?? 'normal'];
  const total = pool.reduce((sum, i) => sum + weight(i), 0);
  if (!pool.length || total <= 0) return null;
  let r = rng() * total;
  for (const item of pool) {
    r -= weight(item);
    if (r <= 0) return item;
  }
  return pool[pool.length - 1];
}

interface LoadedTexture {
  texture: THREE.Texture;
  aspect: number;
  url: string;
}

interface ActiveSprite {
  sprite: THREE.Sprite;
  assetId: string;
  moving: boolean;
  pattern: MovementPattern | null;
  s: number;
  d: number;
  /** Preferred lateral offset for lane patterns. */
  laneD: number;
  vs: number;
  vd: number;
  age: number;
  endD: number;
  halfWidth: number;
}

const EDGE = CONFIG.road.halfWidth + CONFIG.road.shoulderWidth;

/**
 * Renders parents' drawings as billboards: static ones beside the road,
 * moving ones following one of a few predefined movement patterns.
 * AI never controls movement — it only said whether the object can move.
 */
export class DrawingSpriteLayer {
  readonly group = new THREE.Group();
  private sources: SpriteSource[] = [];
  private readonly textures = new Map<string, LoadedTexture>();
  private readonly loading = new Map<string, Promise<LoadedTexture | null>>();
  private readonly active: ActiveSprite[] = [];
  private readonly free: THREE.Sprite[] = [];
  private nextStaticS = 40;
  private nextMovingIn = 4;
  private lastStaticId: string | null = null;
  private lastMovingId: string | null = null;
  private lastProgress = 0;
  private readonly p = { x: 0, z: 0 };
  private spawnListener: ((id: string) => void) | null = null;

  constructor(
    private readonly road: RoadPath,
    private readonly speed: number = CONFIG.driving.speed,
    private readonly rng: () => number = Math.random,
  ) {}

  activeCount(): number {
    return this.active.length;
  }

  /** Called whenever a drawing appears in the world (diagnostics: impressions). */
  onSpawn(listener: (id: string) => void): void {
    this.spawnListener = listener;
  }

  setSources(sources: readonly SpriteSource[]): void {
    const ids = new Set(sources.map((s) => s.id));
    // Remove sprites and textures of deleted drawings.
    for (let i = this.active.length - 1; i >= 0; i--) {
      if (!ids.has(this.active[i].assetId)) this.release(i);
    }
    for (const [id, tex] of this.textures) {
      if (!ids.has(id)) {
        tex.texture.dispose();
        URL.revokeObjectURL(tex.url);
        this.textures.delete(id);
      }
    }
    // A drawing switched between MOVES and STAYS: retire its sprites and show it again soon.
    const previous = new Map(this.sources.map((s) => [s.id, s.moves]));
    const toggled = sources.filter((s) => previous.has(s.id) && previous.get(s.id) !== s.moves);
    for (let i = this.active.length - 1; i >= 0; i--) {
      if (toggled.some((s) => s.id === this.active[i].assetId)) this.release(i);
    }
    this.sources = [...sources];
    for (const source of sources) void this.ensureTexture(source);
    for (const source of toggled) void this.spawnSoon(source.id, this.lastProgress);
  }

  /** Show a newly added drawing soon, so the parent sees it appear. */
  async spawnSoon(id: string, progress: number): Promise<void> {
    const source = this.sources.find((s) => s.id === id);
    if (!source) return;
    const tex = await this.ensureTexture(source);
    if (!tex) return;
    if (source.moves) this.spawnMoving(source, tex, progress, 'sameDirection');
    else this.spawnStatic(source, tex, progress + 60);
  }

  /**
   * @param progress  Bus position along the road.
   * @param busD      Bus lateral offset (lane drawings make way for it).
   */
  update(dt: number, progress: number, busD = 0): void {
    this.lastProgress = progress;
    // Static drawings at irregular spacing ahead.
    if (progress + CONFIG.drawings.spawnDistance >= this.nextStaticS) {
      if (this.count(false) < CONFIG.drawings.maxStaticSprites) {
        const source = pickWeighted(this.sources.filter((s) => !s.moves && this.textures.has(s.id)), this.rng, this.lastStaticId);
        const tex = source && this.textures.get(source.id);
        if (source && tex) this.spawnStatic(source, tex, progress + CONFIG.drawings.spawnDistance);
      }
      const { min, max } = CONFIG.drawings.staticSpacing;
      this.nextStaticS = progress + CONFIG.drawings.spawnDistance + min + this.rng() * (max - min);
    }

    // Moving drawings every few seconds.
    this.nextMovingIn -= dt;
    if (this.nextMovingIn <= 0) {
      if (this.count(true) < CONFIG.drawings.maxMovingSprites) {
        const source = pickWeighted(this.sources.filter((s) => s.moves && this.textures.has(s.id)), this.rng, this.lastMovingId);
        const tex = source && this.textures.get(source.id);
        const patterns = this.rng() < CONFIG.drawings.laneMovingChance ? LANE_PATTERNS : ROADSIDE_PATTERNS;
        const pattern = patterns[Math.floor(this.rng() * patterns.length)];
        if (source && tex) this.spawnMoving(source, tex, progress, pattern);
      }
      const { min, max } = CONFIG.drawings.movingIntervalSec;
      this.nextMovingIn = min + this.rng() * (max - min);
    }

    const lanes = CONFIG.lanes;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      a.age += dt;
      a.s += a.vs * dt;
      if (isLane(a.pattern)) {
        // Make way for the bus, then drift back into the lane.
        const target = avoidanceTarget({ s: a.s, laneD: a.laneD, d: a.d, busS: progress, busD, clearance: 1.35 + a.halfWidth }, lanes);
        const step = lanes.dodgeSpeed * dt;
        a.d = Math.abs(target - a.d) <= step ? target : a.d + Math.sign(target - a.d) * step;
      } else {
        a.d += a.vd * dt;
      }
      const crossedDone = a.pattern === 'crossingFar' && Math.sign(a.vd) * (a.d - a.endD) > 0;
      const bumped = isLane(a.pattern) && overlapsBus(a.s, a.d, progress, busD, a.halfWidth);
      if (a.s < progress - 14 || a.s > progress + 260 || a.age > 90 || crossedDone || bumped) {
        this.release(i);
        continue;
      }
      this.road.point(a.s, a.d, this.p);
      a.sprite.position.set(this.p.x, 0, this.p.z);
      if (a.moving) {
        // Friendly hop + wobble so moving drawings feel alive.
        a.sprite.position.y = Math.abs(Math.sin(a.age * 6)) * 0.35;
        a.sprite.material.rotation = Math.sin(a.age * 6) * 0.06;
      }
    }
  }

  private count(moving: boolean): number {
    return this.active.reduce((n, a) => n + (a.moving === moving ? 1 : 0), 0);
  }

  private spawnStatic(source: SpriteSource, tex: LoadedTexture, s: number): void {
    const side = this.rng() < 0.5 ? -1 : 1;
    const d = side * (EDGE + 1.5 + this.rng() * 4.5);
    this.lastStaticId = source.id;
    this.activate(source.id, tex, false, null, s, d, 0, 0, d);
  }

  private spawnMoving(source: SpriteSource, tex: LoadedTexture, progress: number, pattern: MovementPattern): void {
    const side = this.rng() < 0.5 ? -1 : 1;
    const v = this.speed;
    const lane = CONFIG.lanes.laneOffset;
    this.lastMovingId = source.id;
    switch (pattern) {
      case 'laneSameDirection':
        // In the right lane ahead, slower than the bus, moving aside as it passes.
        this.activate(source.id, tex, true, pattern, progress + 70, lane, v * 0.5, 0, 0);
        break;
      case 'laneOppositeDirection':
        this.activate(source.id, tex, true, pattern, progress + 160, -lane, -v * 0.55, 0, 0);
        break;
      case 'sameDirection':
        // Slower than the bus, so the child catches up and overtakes it.
        this.activate(source.id, tex, true, pattern, progress + 60, side * (EDGE + 2), v * 0.55, 0, 0);
        break;
      case 'oppositeDirection':
        this.activate(source.id, tex, true, pattern, progress + 150, side * (EDGE + 2), -v * 0.6, 0, 0);
        break;
      case 'parallelFar':
        this.activate(source.id, tex, true, pattern, progress + 90, side * (EDGE + 14 + this.rng() * 8), v * 0.9, 0, 0);
        break;
      case 'crossingFar': {
        // Crosses far ahead and is gone well before the bus arrives.
        const start = side * (EDGE + 14);
        this.activate(source.id, tex, true, pattern, progress + 75, start, 0, -side * 6.5, -start);
        break;
      }
    }
  }

  private activate(
    assetId: string,
    tex: LoadedTexture,
    moving: boolean,
    pattern: MovementPattern | null,
    s: number,
    d: number,
    vs: number,
    vd: number,
    endD: number,
  ): void {
    const sprite = this.free.pop() ?? this.createSprite();
    sprite.material.map = tex.texture;
    sprite.material.rotation = 0;
    sprite.material.needsUpdate = true;
    let height: number = moving ? CONFIG.drawings.spriteHeight * 0.85 : CONFIG.drawings.spriteHeight;
    let width = height * tex.aspect;
    const maxWidth = 6;
    if (width > maxWidth) {
      height *= maxWidth / width;
      width = maxWidth;
    }
    sprite.scale.set(width, height, 1);
    sprite.visible = true;
    this.group.add(sprite);
    this.active.push({ sprite, assetId, moving, pattern, s, d, laneD: d, vs, vd, age: 0, endD, halfWidth: width / 2 });
    this.spawnListener?.(assetId);
  }

  private release(index: number): void {
    const [a] = this.active.splice(index, 1);
    a.sprite.visible = false;
    a.sprite.material.map = null;
    this.group.remove(a.sprite);
    this.free.push(a.sprite);
  }

  private createSprite(): THREE.Sprite {
    const material = new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.04, fog: true });
    const sprite = new THREE.Sprite(material);
    sprite.center.set(0.5, 0);
    return sprite;
  }

  private ensureTexture(source: SpriteSource): Promise<LoadedTexture | null> {
    const existing = this.textures.get(source.id);
    if (existing) return Promise.resolve(existing);
    const pending = this.loading.get(source.id);
    if (pending) return pending;
    const promise = loadTexture(source.image)
      .then((tex) => {
        if (this.sources.some((s) => s.id === source.id)) this.textures.set(source.id, tex);
        else {
          tex.texture.dispose();
          URL.revokeObjectURL(tex.url);
        }
        return tex;
      })
      .catch((err) => {
        console.warn('[leo] could not load drawing texture', err);
        return null;
      })
      .finally(() => this.loading.delete(source.id));
    this.loading.set(source.id, promise);
    return promise;
  }
}

async function loadTexture(blob: Blob): Promise<LoadedTexture> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
  const texture = new THREE.Texture(img);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return { texture, aspect: img.naturalWidth / Math.max(1, img.naturalHeight), url };
}

function isLane(pattern: MovementPattern | null): boolean {
  return pattern === 'laneSameDirection' || pattern === 'laneOppositeDirection';
}
