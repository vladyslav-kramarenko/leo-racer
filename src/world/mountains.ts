import * as THREE from 'three';
import type { HillsPreset } from './presets/types';
import { createRng, hashInt } from './random';

const SIDES = 12;
type Point = [number, number, number];

/** Static, faceted alpine skyline. Each peak has irregular buttresses, a shoulder,
 * a broken snow line and an offset summit. All faces share one vertex-coloured
 * geometry/material; no textures, additional draw calls or per-frame generation. */
export function createMountainRange(hills: HillsPreset, radius: number, count = 46): THREE.BufferGeometry {
  const layout = createRng(42);
  const positions: number[] = [];
  const colors: number[] = [];
  const snow = new THREE.Color(hills.snowCap ?? '#f4f8fb');

  for (let i = 0; i < count; i++) {
    // Preserve the original horizon layout, height ranges and seeded placement.
    const angle = i / count * Math.PI * 2 + layout() * 0.08;
    const distance = radius + layout() * 12;
    const height = hills.height[0] + layout() * (hills.height[1] - hills.height[0]);
    const width = hills.width[0] + layout() * (hills.width[1] - hills.width[0]);
    const yaw = layout() * Math.PI;
    const cx = Math.cos(angle) * distance;
    const cz = Math.sin(angle) * distance;
    const rng = createRng(hashInt(i, 137));
    const rock = new THREE.Color(hills.colors[i % hills.colors.length]);
    const ridge = rock.clone().lerp(new THREE.Color('#8d969d'), 0.16);
    const offsetX = (rng() - 0.5) * width * 0.22;
    const offsetZ = (rng() - 0.5) * width * 0.22;
    const ridgeScale = Array.from({ length: SIDES }, (_, j) =>
      (j % 2 === 0 ? 1.04 : 0.82) * (0.9 + rng() * 0.2));
    const angles = Array.from({ length: SIDES }, (_, j) => yaw + j / SIDES * Math.PI * 2);
    const ring = (level: number, spread: number, jitter: number): Point[] =>
      angles.map((theta, j) => {
        const t = level + (rng() - 0.5) * jitter;
        const r = width * spread * ridgeScale[j] * (0.91 + rng() * 0.18);
        return [cx + offsetX * t + Math.cos(theta) * r, -1 + height * t,
          cz + offsetZ * t + Math.sin(theta) * r];
      });
    const base = ring(0, 0.92, 0);
    const shoulder = ring(0.35, 0.63, 0.16);
    const snowline = ring(0.68, 0.32, 0.20);
    const summit: Point = [cx + offsetX, height - 1, cz + offsetZ];

    const face = (a: Point, b: Point, c: Point, palette: THREE.Color, variation: number) => {
      const tone = palette.clone().multiplyScalar(variation);
      positions.push(...a, ...b, ...c);
      for (let k = 0; k < 3; k++) colors.push(tone.r, tone.g, tone.b);
    };
    const strip = (lower: Point[], upper: Point[], palette: THREE.Color) => {
      for (let j = 0; j < SIDES; j++) {
        const next = (j + 1) % SIDES;
        const shade = 0.91 + rng() * 0.16;
        face(lower[j], upper[j], lower[next], palette, shade);
        face(lower[next], upper[j], upper[next], palette, shade * (0.97 + rng() * 0.06));
      }
    };
    strip(base, shoulder, rock);
    strip(shoulder, snowline, ridge);
    for (let j = 0; j < SIDES; j++) {
      face(snowline[j], summit, snowline[(j + 1) % SIDES], snow, 0.94 + rng() * 0.06);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
