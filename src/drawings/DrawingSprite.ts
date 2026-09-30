import * as THREE from 'three';
import { CONFIG } from '../game/config';

/** The only thing the sprite layer needs from the world: a road to place things along. */
export interface RoadPath {
  point(s: number, d: number, out?: { x: number; z: number }): { x: number; z: number };
}

export interface SpriteSource {
  id: string;
  image: Blob;
  moves: boolean;
}

export type MovementPattern = 'sameDirection' | 'oppositeDirection' | 'parallelFar' | 'crossingFar';
export const MOVEMENT_PATTERNS: readonly MovementPattern[] = [
  'sameDirection',
  'oppositeDirection',
  'parallelFar',
  'crossingFar',
];

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
  vs: number;
  vd: number;
  age: number;
  endD: number;
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
  private staticCursor = 0;
  private lastProgress = 0;
  private movingCursor = 0;
  private readonly p = { x: 0, z: 0 };

  constructor(
    private readonly road: RoadPath,
    private readonly speed: number = CONFIG.driving.speed,
    private readonly rng: () => number = Math.random,
  ) {}

  activeCount(): number {
    return this.active.length;
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

  update(dt: number, progress: number): void {
    this.lastProgress = progress;
    // Static drawings at irregular spacing ahead.
    if (progress + CONFIG.drawings.spawnDistance >= this.nextStaticS) {
      const statics = this.sources.filter((s) => !s.moves);
      if (statics.length && this.count(false) < CONFIG.drawings.maxStaticSprites) {
        const source = statics[this.staticCursor++ % statics.length];
        const tex = this.textures.get(source.id);
        if (tex) this.spawnStatic(source, tex, progress + CONFIG.drawings.spawnDistance);
      }
      const { min, max } = CONFIG.drawings.staticSpacing;
      this.nextStaticS = progress + CONFIG.drawings.spawnDistance + min + this.rng() * (max - min);
    }

    // Moving drawings every few seconds.
    this.nextMovingIn -= dt;
    if (this.nextMovingIn <= 0) {
      const movers = this.sources.filter((s) => s.moves);
      if (movers.length && this.count(true) < CONFIG.drawings.maxMovingSprites) {
        const source = movers[this.movingCursor++ % movers.length];
        const tex = this.textures.get(source.id);
        const pattern = MOVEMENT_PATTERNS[Math.floor(this.rng() * MOVEMENT_PATTERNS.length)];
        if (tex) this.spawnMoving(source, tex, progress, pattern);
      }
      const { min, max } = CONFIG.drawings.movingIntervalSec;
      this.nextMovingIn = min + this.rng() * (max - min);
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      a.age += dt;
      a.s += a.vs * dt;
      a.d += a.vd * dt;
      const crossedDone = a.pattern === 'crossingFar' && Math.sign(a.vd) * (a.d - a.endD) > 0;
      if (a.s < progress - 14 || a.age > 90 || crossedDone) {
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
    this.activate(source.id, tex, false, null, s, d, 0, 0, d);
  }

  private spawnMoving(source: SpriteSource, tex: LoadedTexture, progress: number, pattern: MovementPattern): void {
    const side = this.rng() < 0.5 ? -1 : 1;
    const v = this.speed;
    switch (pattern) {
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
    this.active.push({ sprite, assetId, moving, pattern, s, d, vs, vd, age: 0, endD });
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
