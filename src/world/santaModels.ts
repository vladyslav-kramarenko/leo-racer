import * as THREE from 'three';
import { box, buildColoredGeometry, cone, cyl, ico, rbox, type ColoredPart } from './geometry';

const RED = '#dc3d46';
const WHITE = '#fff8e9';
const GOLD = '#edbf54';
const DARK = '#343849';
const BROWN = '#b88252';

function beam(a: [number, number, number], b: [number, number, number], radius: number, color: string): ColoredPart {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const direction = end.clone().sub(start);
  const geometry = cyl(radius, radius, direction.length(), 6);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
  return { geometry, color, position: start.add(end).multiplyScalar(0.5).toArray() as [number, number, number] };
}

function tube(points: [number, number, number][], radius: number, color: string): ColoredPart {
  return { geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 16, radius, 6, false), color };
}

/** Local front is -Z. Four reindeer pull a red sleigh with a seated Santa and gift stack. */
export function santaSleighModel(): { body: THREE.BufferGeometry; arm: THREE.BufferGeometry; leg: THREE.BufferGeometry; legPivots: THREE.Vector3[] } {
  const parts: ColoredPart[] = [
    { geometry: rbox(2.7, 0.45, 4.7, 0.18), color: RED, position: [0, 0.8, 0.9] },
    { geometry: rbox(2.4, 0.2, 4, 0.08), color: GOLD, position: [0, 0.55, 1] },
    { geometry: rbox(2.6, 1.15, 0.3, 0.15), color: RED, position: [0, 1.55, 3.05] },
    { geometry: rbox(2.5, 0.9, 0.3, 0.12), color: RED, position: [0, 1.25, -1.35] },
    { geometry: rbox(2.2, 0.3, 1.1), color: '#75304b', position: [0, 1.25, -0.55] },
    // Santa: boots, red coat, belt, white trim, rosy face, beard and floppy hat.
    { geometry: ico(0.63, 1), color: RED, position: [0, 2.1, -0.55], scale: [1.05, 1.1, 0.8] },
    { geometry: cyl(0.62, 0.62, 0.16), color: DARK, position: [0, 1.95, -0.55], scale: [1, 1, 0.82] },
    { geometry: rbox(0.23, 0.19, 0.08), color: GOLD, position: [0, 1.95, -1.08] },
    { geometry: cyl(0.59, 0.59, 0.14), color: WHITE, position: [0, 1.55, -0.55], scale: [1, 1, 0.82] },
    { geometry: ico(0.39, 1), color: '#ffcfaa', position: [0, 2.95, -0.62] },
    { geometry: ico(0.1, 1), color: '#f1a18c', position: [0, 2.96, -1] },
    { geometry: cone(0.38, 0.72, 10), color: WHITE, position: [0, 2.66, -0.86], rotation: [0, 0, Math.PI], scale: [1, 1, 0.6] },
    { geometry: ico(0.16, 1), color: WHITE, position: [0, 2.88, -0.99], scale: [1.6, 0.65, 0.6] },
    { geometry: cyl(0.4, 0.4, 0.13), color: WHITE, position: [0, 3.21, -0.62] },
    { geometry: cone(0.39, 0.7, 10), color: RED, position: [-0.09, 3.59, -0.62], rotation: [0, 0, 0.28] },
    { geometry: ico(0.15, 1), color: WHITE, position: [-0.2, 3.94, -0.62] },
    beam([-0.53, 2.38, -0.55], [-0.72, 2.13, -1.12], 0.15, RED),
    { geometry: ico(0.18, 1), color: WHITE, position: [-0.72, 2.13, -1.15] },
    { geometry: ico(0.75, 1), color: '#b18a56', position: [0.5, 1.6, 2.1], scale: [1, 1.3, 0.9] },
  ];
  for (const x of [-0.15, 0.15]) parts.push({ geometry: ico(0.035), color: DARK, position: [x, 3.03, -0.96] });
  for (const x of [-0.35, 0.35]) parts.push({ geometry: rbox(0.38, 0.3, 0.75, 0.1), color: DARK, position: [x, 1.25, -1] });
  for (const side of [-1, 1]) {
    const x = side * 1.43;
    parts.push(
      { geometry: rbox(0.16, 0.7, 4.1), color: RED, position: [x, 1.4, 0.9] },
      { geometry: rbox(0.18, 0.1, 4.2), color: GOLD, position: [x, 1.77, 0.9] },
      tube([[x, 0.2, 3.5], [x, 0.12, 0], [x, 0.16, -1.9], [x, 0.6, -2.25], [x, 0.8, -1.95]], 0.09, GOLD),
      beam([x, 0.22, -0.4], [x, 0.8, -0.4], 0.07, GOLD),
      beam([x, 0.22, 2.1], [x, 0.8, 2.1], 0.07, GOLD),
      tube([[side * 0.72, 2.13, -1.15], [side * 1.2, 1.9, -3], [side * 1.3, 1.7, -5], [side * 1.3, 1.7, -9.5]], 0.035, '#63503f'),
    );
  }
  for (const [x, y, z, color] of [[-0.65, 1.45, 1.4, '#408ebd'], [-0.6, 2.05, 1.6, '#75ac64'], [0.35, 1.25, 0.8, '#bf70b2']] as const) {
    parts.push({ geometry: rbox(0.85, 0.6, 0.85), color, position: [x, y, z] });
    parts.push({ geometry: box(0.13, 0.63, 0.87), color: GOLD, position: [x, y, z] });
    parts.push({ geometry: box(0.87, 0.63, 0.13), color: GOLD, position: [x, y, z] });
    parts.push({ geometry: ico(0.12), color: GOLD, position: [x, y + 0.38, z], scale: [1.5, 0.7, 1] });
  }
  const legPivots: THREE.Vector3[] = [];
  for (const z of [-5, -9.5]) for (const x of [-1.3, 1.3]) {
    parts.push(
      { geometry: rbox(0.8, 0.8, 1.8, 0.2), color: BROWN, position: [x, 1.6, z] },
      { geometry: rbox(0.84, 0.84, 0.15), color: RED, position: [x, 1.6, z - 0.2] },
      { geometry: cyl(0.22, 0.3, 0.85, 8), color: BROWN, position: [x, 2.06, z - 0.82], rotation: [-0.35, 0, 0] },
      { geometry: ico(0.36, 1), color: BROWN, position: [x, 2.46, z - 1.05], scale: [0.9, 1, 1.1] },
      { geometry: rbox(0.39, 0.3, 0.52), color: '#e1bc8c', position: [x, 2.32, z - 1.4] },
      { geometry: ico(0.11, 1), color: z < -9 && x < 0 ? '#f54b52' : DARK, position: [x, 2.35, z - 1.7] },
      { geometry: ico(0.14), color: WHITE, position: [x, 1.7, z + 0.95] },
    );
    for (const side of [-1, 1]) {
      parts.push({ geometry: ico(0.05), color: DARK, position: [x + side * 0.28, 2.52, z - 1.27] });
      parts.push({ geometry: cone(0.12, 0.3, 6), color: BROWN, position: [x + side * 0.3, 2.8, z - 0.92], rotation: [0, 0, -side * 0.4] });
      parts.push(beam([x + side * 0.23, 2.7, z - 0.96], [x + side * 0.55, 3.4, z - 0.68], 0.045, '#dec396'));
      for (let i = 0; i < 3; i++) parts.push(beam([x + side * (0.3 + i * 0.1), 2.88 + i * 0.2, z - 0.9 + i * 0.1],
        [x + side * (0.43 + i * 0.1), 3.13 + i * 0.2, z - 1.12 + i * 0.1], 0.035, '#dec396'));
      for (const dz of [-0.56, 0.56]) legPivots.push(new THREE.Vector3(x + side * 0.25, 1.3, z + dz));
    }
  }
  return {
    body: buildColoredGeometry(parts),
    arm: buildColoredGeometry([
      { geometry: rbox(0.3, 0.6, 0.3, 0.08), color: RED, position: [0, 0.24, 0] },
      { geometry: cyl(0.18, 0.18, 0.12, 8), color: WHITE, position: [0, 0.55, 0] },
      { geometry: ico(0.2, 1), color: WHITE, position: [0, 0.72, 0] },
    ]),
    leg: buildColoredGeometry([
      { geometry: cyl(0.09, 0.075, 0.8, 8), color: BROWN, position: [0, -0.4, 0] },
      { geometry: rbox(0.19, 0.16, 0.27, 0.04), color: DARK, position: [0, -0.79, -0.03] },
    ]),
    legPivots,
  };
}
