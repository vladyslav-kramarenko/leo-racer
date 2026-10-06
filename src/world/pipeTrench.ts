import * as THREE from 'three';
import { box, buildColoredGeometry, cyl, ico, rbox, type ColoredPart } from './geometry';
import type { PropModel } from './props';

/** Open excavation with a newly laid blue main, shoring and an excavator. */
export function pipeTrench(): PropModel {
  const parts: ColoredPart[] = [];
  const addBox = (w: number, h: number, d: number, color: string, x: number, y: number, z: number) => {
    parts.push({ geometry: box(w, h, d), color, position: [x, y, z] });
  };
  // The terrain shader opens this rectangle; walls and the pipe are genuinely below grade.
  addBox(3.8, 0.12, 24, '#5a422d', 0, -2.16, 0);
  for (const x of [-2.05, 2.05]) {
    addBox(0.3, 2.2, 24.4, '#a77a49', x, -1.05, 0);
    // Visible soil layers and timber shoring along both sides.
    addBox(0.32, 0.3, 24.4, '#d3ae76', x, -0.32, 0);
    addBox(0.32, 0.25, 24.4, '#8a6240', x, -1.45, 0);
    for (const z of [-10, -6, -2, 2, 6, 10]) addBox(0.2, 2.15, 0.22, '#755436', x * 0.92, -1.02, z);
  }
  for (const z of [-12.1, 12.1]) addBox(4.1, 2.2, 0.2, '#a77a49', 0, -1.05, z);
  const pipe = (x: number, y: number, z: number, length: number) => {
    parts.push({ geometry: cyl(0.7, 0.7, length, 16), color: '#358dcb', position: [x, y, z], rotation: [Math.PI / 2, 0, 0] });
    for (const end of [-1, 1]) {
      parts.push({ geometry: cyl(0.58, 0.58, 0.025, 16), color: '#173d53', position: [x, y, z + end * (length / 2 + 0.015)], rotation: [Math.PI / 2, 0, 0] });
      parts.push({ geometry: new THREE.TorusGeometry(0.65, 0.075, 6, 16), color: '#a9b9be', position: [x, y, z + end * length / 2] });
    }
  };
  for (const z of [-8.5, -3.5, 1.5]) pipe(0, -1.35, z, 4.8);
  // An unfilled working end exposes the dark trench bottom ahead of the pipeline.
  for (const z of [-7, -1]) {
    pipe(5.2, 0.78, z, 4.8);
    for (const chock of [-1.8, 1.8]) addBox(2.1, 0.14, 0.25, '#8f663d', 5.2, 0.12, z + chock);
  }
  for (let i = 0; i < 8; i++) {
    parts.push({ geometry: ico(1.3, 1), color: i % 2 ? '#bb8e55' : '#cda266', position: [4.2, 0.45, -10 + i * 2.6], scale: [1.1, 0.7, 1.1] });
  }
  // Compact yellow excavator reaches over the open working end of the trench.
  const yellow = '#ffc52b';
  for (const x of [3.9, 6.1]) {
    parts.push({ geometry: rbox(0.7, 0.65, 3.6, 0.25), color: '#34383b', position: [x, 0.38, 8.6] });
    for (const z of [7.5, 8.6, 9.7]) parts.push({ geometry: cyl(0.2, 0.2, 0.72, 10), color: '#777e84', position: [x, 0.38, z], rotation: [0, 0, Math.PI / 2] });
  }
  parts.push(
    { geometry: rbox(3, 0.8, 2.5, 0.18), color: yellow, position: [5, 1.12, 8.6] },
    { geometry: rbox(1.4, 1.8, 1.7, 0.15), color: yellow, position: [5.8, 2.2, 8.6] },
    { geometry: box(0.05, 1.15, 1.25), color: '#92d0e7', position: [5.08, 2.3, 8.6] },
    { geometry: rbox(1.6, 0.18, 1.9, 0.05), color: '#40484b', position: [5.8, 3.17, 8.6] },
  );
  const beam = (a: [number, number, number], b: [number, number, number], width: number, color: string) => {
    const from = new THREE.Vector3(...a);
    const to = new THREE.Vector3(...b);
    const vector = to.clone().sub(from);
    const geometry = rbox(width, vector.length(), width, width * 0.2);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize()));
    parts.push({ geometry, color, position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] });
  };
  beam([4.2, 1.5, 8.6], [2, 3.8, 8.6], 0.4, yellow);
  beam([2, 3.8, 8.6], [0.2, -0.4, 8.6], 0.32, yellow);
  beam([4.2, 1.6, 8.35], [2.5, 3.3, 8.35], 0.14, '#c8d0d3');
  parts.push({ geometry: rbox(1.3, 0.65, 0.95, 0.08), color: '#70787b', position: [0.2, -0.72, 8.6], rotation: [0, 0, -0.3] });
  // Red/white guards on the road side and across the two ends.
  for (const z of [-10, -5, 0, 5, 10]) {
    for (const dz of [-0.85, 0.85]) {
      addBox(0.12, 1.05, 0.12, '#777f86', -3.1, 0.52, z + dz);
      addBox(0.55, 0.1, 0.4, '#40484b', -3.1, 0.05, z + dz);
    }
    for (let stripe = 0; stripe < 6; stripe++) addBox(0.12, 0.3, 0.33, stripe % 2 ? '#fff4df' : '#ef5140', -3.1, 0.84, z - 0.83 + stripe * 0.332);
  }
  for (const z of [-13, 13]) {
    for (const x of [-1.8, 1.8]) addBox(0.12, 1.1, 0.12, '#777f86', x, 0.55, z);
    for (let stripe = 0; stripe < 10; stripe++) addBox(0.38, 0.35, 0.12, stripe % 2 ? '#fff4df' : '#ef5140', -1.7 + stripe * 0.38, 0.85, z);
  }
  return { body: buildColoredGeometry(parts), groundCutout: { center: [0, 0], size: [3.8, 24] } };
}
