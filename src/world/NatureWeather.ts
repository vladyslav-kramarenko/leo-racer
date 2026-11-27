import * as THREE from 'three';
import type { WeatherPreset } from './presets/types';
import { createRng } from './random';
import { WeatherCycle, type WeatherState } from './WeatherCycle';

const wrap = (v: number, min: number, span: number): number => min + ((v - min) % span + span) % span;

/** Seven soft colour bands, one transparent mesh, no texture or extra lights. */
export function rainbowGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const palette = ['#f87976', '#ffc18a', '#ffe89a', '#9bdb9a', '#92d9f2', '#a8b9f1', '#c5a5e5'];
  const point = (r: number, a: number): [number, number, number] => [r * Math.cos(a), r * Math.sin(a), 0];
  for (let band = 0; band < palette.length; band++) {
    const outer = 36 - band * 0.95;
    const inner = outer - 0.95;
    const color = new THREE.Color(palette[band]);
    for (let j = 0; j < 40; j++) {
      const a = j / 40 * Math.PI;
      const b = (j + 1) / 40 * Math.PI;
      const vertices = [point(outer, a), point(inner, a), point(outer, b),
        point(outer, b), point(inner, a), point(inner, b)];
      for (const v of vertices) {
        positions.push(...v);
        colors.push(color.r, color.g, color.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeBoundingSphere();
  return g;
}

/** Lightweight rain: fixed pool of short world-space streaks, drawn in one call. */
export class NatureWeather {
  readonly group = new THREE.Group();
  readonly cycle: WeatherCycle;
  private readonly drops: Float32Array;
  private readonly velocities: Float32Array;
  private readonly rain: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly rainbow: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly previous = new THREE.Vector3();
  private state: WeatherState = { phase: 'clear', rain: 0, rainbow: 0 };

  constructor(preset: WeatherPreset) {
    this.cycle = new WeatherCycle(preset);
    const rng = createRng(571);
    this.drops = new Float32Array(preset.drops * 3);
    this.velocities = new Float32Array(preset.drops);
    for (let i = 0; i < preset.drops; i++) {
      this.drops.set([rng() * 64 - 32, rng() * 22 + 0.5, rng() * 84 - 64], i * 3);
      this.velocities[i] = 9 + rng() * 5;
    }
    const lines = new THREE.BufferGeometry();
    lines.setAttribute('position', new THREE.BufferAttribute(new Float32Array(preset.drops * 6), 3).setUsage(THREE.DynamicDrawUsage));
    this.rain = new THREE.LineSegments(lines, new THREE.LineBasicMaterial({
      color: '#c8deee', transparent: true, opacity: 0, depthWrite: false,
    }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.rainbow = new THREE.Mesh(rainbowGeometry(), new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0,
      depthWrite: false, fog: false,
    }));
    this.rainbow.visible = false;
    this.group.add(this.rain, this.rainbow);
  }

  reset(): void {
    this.cycle.reset();
    this.state = { phase: 'clear', rain: 0, rainbow: 0 };
    this.rain.visible = false;
    this.rainbow.visible = false;
  }

  get rainAmount(): number { return this.state.rain; }
  get phase(): string { return this.state.phase; }

  update(dt: number, focus: THREE.Vector3, heading: number, active: boolean): WeatherState {
    this.state = active ? this.cycle.update(dt) : { phase: 'clear', rain: 0, rainbow: 0 };
    const { rain, rainbow } = this.state;
    this.rain.visible = rain > 0.001;
    this.rain.material.opacity = rain * 0.48;
    const dx = focus.x - this.previous.x;
    const dz = focus.z - this.previous.z;
    this.previous.copy(focus);
    if (this.rain.visible) {
      const attr = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
      const v = attr.array as Float32Array;
      for (let i = 0; i < this.velocities.length; i++) {
        const j = i * 3;
        const x = this.drops[j] = wrap(this.drops[j] - dx + 1.8 * dt, -32, 64);
        const y = this.drops[j + 1] = wrap(this.drops[j + 1] - this.velocities[i] * dt, 0.5, 22);
        const z = this.drops[j + 2] = wrap(this.drops[j + 2] - dz, -64, 84);
        v.set([x, y, z, x - 0.12, y + 0.75, z], i * 6);
      }
      attr.needsUpdate = true;
      this.rain.position.set(focus.x, 0, focus.z);
    }
    this.rainbow.visible = rainbow > 0.001;
    this.rainbow.material.opacity = rainbow * 0.78;
    // Offset into the right-hand sky, ahead of the distant mountains. Trees may occlude it.
    const sin = Math.sin(heading), cos = Math.cos(heading);
    this.rainbow.position.set(focus.x + sin * 110 + cos * 17, -4, focus.z - cos * 110 + sin * 17);
    this.rainbow.rotation.y = -heading;
    return this.state;
  }
}
