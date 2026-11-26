import * as THREE from 'three';
import { box, buildColoredGeometry, cyl, extrudeProfile, ico, rbox, type ColoredPart } from './geometry';

const YELLOW = '#f5c645';
const RED = '#d64e3d';
const METAL = '#687586';
const DARK = '#354052';
const GLASS = '#86cde5';

function strut(a: [number, number, number], b: [number, number, number]): ColoredPart {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const direction = end.clone().sub(start);
  const geometry = cyl(0.045, 0.045, direction.length(), 6);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
  return { geometry, color: METAL, position: start.add(end).multiplyScalar(0.5).toArray() as [number, number, number] };
}

/** Original toy crop-duster inspired by classic utility biplanes; nose points along -Z. */
export function biplaneModel(): { body: THREE.BufferGeometry; propeller: THREE.BufferGeometry } {
  const parts: ColoredPart[] = [
    { geometry: rbox(1.55, 1.25, 4.8, 0.28, 2), color: YELLOW, position: [0, 0, -0.6] },
    { geometry: cyl(0.25, 0.62, 2.8, 12), color: YELLOW, position: [0, 0.06, 2.9], rotation: [Math.PI / 2, 0, 0] },
    { geometry: cyl(0.63, 0.63, 0.6, 12), color: '#c99d37', position: [0, 0, -3.15], rotation: [Math.PI / 2, 0, 0] },
    { geometry: cyl(0.12, 0.12, 0.3, 8), color: METAL, position: [0, 0, -3.55], rotation: [Math.PI / 2, 0, 0] },
    // Two broad wings, with rounded red tips.
    { geometry: rbox(11.5, 0.18, 1.65, 0.085), color: YELLOW, position: [0, 1.35, -0.5] },
    { geometry: rbox(10.6, 0.18, 1.75, 0.085), color: YELLOW, position: [0, -0.44, -0.25] },
    // Glazed cockpit and tail surfaces.
    { geometry: rbox(1.25, 0.85, 1.45, 0.17), color: GLASS, position: [0, 0.64, -1.76] },
    { geometry: rbox(1.3, 0.12, 1.5), color: YELLOW, position: [0, 1.07, -1.72] },
    { geometry: box(0.07, 0.68, 0.08), color: YELLOW, position: [0, 0.67, -2.5] },
    { geometry: rbox(3.7, 0.13, 1.3), color: YELLOW, position: [0, 0.17, 3.4] },
    { geometry: extrudeProfile([[-0.8, 0], [0.8, 0], [0.6, 1.5], [-0.2, 1.7]], 0.17), color: YELLOW,
      position: [0, 0.1, 3.6], rotation: [0, -Math.PI / 2, 0] },
    { geometry: rbox(0.19, 1.2, 0.35), color: RED, position: [0, 0.9, 4.08] },
    { geometry: cyl(0.17, 0.17, 0.18, 10), color: DARK, position: [0, -0.42, 3.65], rotation: [0, 0, Math.PI / 2] },
  ];
  for (const side of [-1, 1]) {
    parts.push(
      { geometry: rbox(0.9, 0.19, 1.67, 0.085), color: RED, position: [side * 5.3, 1.35, -0.5] },
      { geometry: rbox(0.7, 0.19, 1.77, 0.085), color: RED, position: [side * 4.96, -0.44, -0.25] },
      { geometry: rbox(0.06, 0.14, 4.1, 0.02), color: RED, position: [side * 0.775, -0.2, -0.25] },
      strut([side * 3.8, -0.34, -0.95], [side * 3.8, 1.25, -1.1]),
      strut([side * 3.8, -0.34, 0.45], [side * 3.8, 1.25, 0.1]),
      strut([side * 3.8, -0.34, -0.95], [side * 3.8, 1.25, 0.1]),
      strut([side * 0.65, 0.65, -0.6], [side * 1.25, 1.25, -0.7]),
      strut([side * 0.5, -0.5, -1.2], [side * 0.87, -1.02, -1.25]),
      { geometry: cyl(0.37, 0.37, 0.28, 12), color: DARK, position: [side * 0.9, -1.08, -1.25], rotation: [0, 0, Math.PI / 2] },
      { geometry: cyl(0.16, 0.16, 0.3, 10), color: METAL, position: [side * 0.9, -1.08, -1.25], rotation: [0, 0, Math.PI / 2] },
    );
    for (const z of [-0.4, 0.55, 1.45]) {
      parts.push({ geometry: rbox(0.06, 0.36, 0.5, 0.025), color: '#f9edc6', position: [side * 0.78, 0.19, z] });
      parts.push({ geometry: rbox(0.065, 0.28, 0.4, 0.02), color: GLASS, position: [side * 0.81, 0.19, z] });
    }
  }
  return {
    body: buildColoredGeometry(parts),
    propeller: buildColoredGeometry([
      { geometry: rbox(0.17, 2.6, 0.1, 0.045), color: DARK },
      { geometry: rbox(0.18, 0.3, 0.11, 0.04), color: '#f3e5b5', position: [0, 1.14, 0] },
      { geometry: rbox(0.18, 0.3, 0.11, 0.04), color: '#f3e5b5', position: [0, -1.14, 0] },
      { geometry: ico(0.24, 1), color: RED, position: [0, 0, -0.13], scale: [1, 1, 1.25] },
    ]),
  };
}
