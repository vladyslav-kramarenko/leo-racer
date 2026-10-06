import * as THREE from 'three';
import { createRng } from './random';

/** Fixed-size, world-anchored particle pool. It advances only with simulation time. */
export class Snowfall {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly velocities: Float32Array;
  private readonly previousFocus = new THREE.Vector3();

  constructor(count: number, private readonly speed: number) {
    const rng = createRng(129);
    const positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions.set([rng() * 80 - 40, rng() * 26 + 0.5, rng() * 130 - 65], i * 3);
      this.velocities[i] = 0.7 + rng() * 0.6;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    // Soft circular sprite without an external image or a DOM canvas.
    const size = 16;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const radius = Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1);
      pixels.set([255, 255, 255, Math.round(Math.max(0, 1 - radius) * 255)], (y * size + x) * 4);
    }
    const map = new THREE.DataTexture(pixels, size, size);
    map.magFilter = THREE.LinearFilter;
    map.needsUpdate = true;
    this.points = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: '#ffffff', size: 0.2, map, transparent: true, opacity: 0.85, depthWrite: false,
    }));
    this.points.frustumCulled = false;
  }

  update(dt: number, focus: THREE.Vector3): void {
    if (dt <= 0) return;
    const attribute = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = attribute.array as Float32Array;
    const dx = focus.x - this.previousFocus.x;
    const dz = focus.z - this.previousFocus.z;
    for (let i = 0; i < this.velocities.length; i++) {
      const j = i * 3;
      positions[j] = wrap(positions[j] - dx + 0.3 * dt, -40, 80);
      positions[j + 1] = wrap(positions[j + 1] - this.speed * this.velocities[i] * dt, 0.5, 26);
      positions[j + 2] = wrap(positions[j + 2] - dz + 0.12 * dt, -65, 130);
    }
    this.previousFocus.copy(focus);
    this.points.position.set(focus.x, 0, focus.z);
    attribute.needsUpdate = true;
  }
}

function wrap(value: number, min: number, span: number): number {
  return min + ((value - min) % span + span) % span;
}
