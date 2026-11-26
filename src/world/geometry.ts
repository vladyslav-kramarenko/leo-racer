import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface ColoredPart {
  geometry: THREE.BufferGeometry;
  color: THREE.ColorRepresentation;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

/**
 * Bake several primitive parts into one vertex-coloured, non-indexed geometry.
 * One geometry per model means one draw call per model type (with instancing).
 */
export function buildColoredGeometry(parts: ColoredPart[]): THREE.BufferGeometry {
  const baked = parts.map((part) => {
    const g = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    part.geometry.dispose();
    g.deleteAttribute('uv');
    tmpEuler.set(...(part.rotation ?? [0, 0, 0]));
    tmpQuat.setFromEuler(tmpEuler);
    tmpPos.set(...(part.position ?? [0, 0, 0]));
    tmpScale.set(...(part.scale ?? [1, 1, 1]));
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    g.applyMatrix4(tmpMatrix);

    const color = new THREE.Color(part.color);
    const count = g.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  });
  const merged = mergeGeometries(baked, false);
  baked.forEach((g) => g.dispose());
  if (!merged) throw new Error('Failed to merge geometry');
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  return merged;
}

export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const cone = (r: number, h: number, seg = 10) => new THREE.ConeGeometry(r, h, seg);
/** Low-poly blob (detail 0–1) for rocks, bushes and tree crowns. */
export const ico = (r: number, detail = 0) => new THREE.IcosahedronGeometry(r, detail);

/**
 * Box with softened edges — the "toy" look.
 * `segments` 1 = a single 45° chamfer (44 triangles — cheap enough for instanced props);
 * 2–4 = smoothly rounded edges for hero silhouettes (300+ triangles).
 */
export function rbox(w: number, h: number, d: number, r = 0.08, segments = 1): THREE.BufferGeometry {
  if (segments > 1) return new RoundedBoxGeometry(w, h, d, segments, r);
  return chamferBox(w, h, d, r);
}

/** Convex hull of the 24 points where a chamfer of size `r` meets the box faces. */
function chamferBox(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const hx = w / 2;
  const hy = h / 2;
  const hz = d / 2;
  const c = Math.max(0.001, Math.min(r, hx * 0.95, hy * 0.95, hz * 0.95));
  const points: THREE.Vector3[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        points.push(
          new THREE.Vector3(sx * hx, sy * (hy - c), sz * (hz - c)),
          new THREE.Vector3(sx * (hx - c), sy * hy, sz * (hz - c)),
          new THREE.Vector3(sx * (hx - c), sy * (hy - c), sz * hz),
        );
      }
    }
  }
  return new ConvexGeometry(points);
}

/** Upper half of a sphere (domes, silo caps, beacon lenses), base at y = 0. */
export const dome = (r: number, segments = 10) =>
  new THREE.SphereGeometry(r, segments, Math.max(3, Math.round(segments / 2)), 0, Math.PI * 2, 0, Math.PI / 2);

/**
 * Extrude a 2D profile (x across, y up) along Z, centred on Z — jersey barriers, boat hulls.
 * A small bevel softens the edges.
 */
export function extrudeProfile(points: [number, number][], length: number, bevel = 0): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: length - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
  });
  g.translate(0, 0, -(length - bevel * 2) / 2);
  return g;
}
/**
 * Triangular prism (gable roof). `width` is the base, `height` the apex height above the base,
 * `length` runs along Z. The base sits at y = 0.
 */
export function prism(width: number, height: number, length: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
  g.translate(0, 0, -length / 2);
  return g;
}

/** Merge already-coloured geometries (same attribute layout) into one. */
export function mergeColored(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(geometries, false);
  if (!merged) throw new Error('Failed to merge geometry');
  merged.computeBoundingSphere();
  return merged;
}

/** Canvas helper that never throws when a 2D context is unavailable. */
export function makeCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return { canvas, ctx };
}
