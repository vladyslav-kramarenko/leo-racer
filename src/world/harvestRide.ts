import * as THREE from 'three';
import { circuitPose } from './circuitPath';
import { box, buildColoredGeometry, cyl, ico, rbox, type ColoredPart } from './geometry';
import type { PartAnim, PartModel, PropModel } from './props';
import { TOY, toyWheel, tractorParts } from './toyParts';

const RADIUS = 9;
const HALF_STRAIGHT = 9;
const PERIOD = 50;
const SPACING = 5.5;
const WOOD = '#a56c3d';
const STRAW = '#ebc86c';

/** Seated visitors in autumn jackets, with hats, faces and feet above the wagon floor. */
function visitor(x: number, z: number, shirt: string, skin: string, hat: string, y = 1.45): ColoredPart[] {
  const parts: ColoredPart[] = [
    { geometry: rbox(0.43, 0.52, 0.36, 0.08), color: shirt, position: [x, y + 0.27, z] },
    { geometry: ico(0.22, 1), color: skin, position: [x, y + 0.78, z - 0.03] },
    { geometry: ico(0.24, 1), color: hat, position: [x, y + 0.92, z], scale: [1, 0.5, 1] },
    { geometry: cyl(0.27, 0.27, 0.06), color: hat, position: [x, y + 0.87, z] },
  ];
  for (const side of [-1, 1]) {
    parts.push(
      { geometry: rbox(0.14, 0.13, 0.4), color: '#435870', position: [x + side * 0.13, y, z - 0.12] },
      { geometry: rbox(0.14, 0.35, 0.14), color: '#435870', position: [x + side * 0.13, y - 0.2, z - 0.28] },
      { geometry: rbox(0.18, 0.1, 0.26), color: TOY.DARK, position: [x + side * 0.13, y - 0.38, z - 0.34] },
      { geometry: rbox(0.12, 0.42, 0.13), color: shirt, position: [x + side * 0.28, y + 0.26, z - 0.08], rotation: [-0.35, 0, side * 0.12] },
      { geometry: ico(0.075), color: skin, position: [x + side * 0.3, y + 0.04, z - 0.16] },
      { geometry: ico(0.025), color: '#343039', position: [x + side * 0.07, y + 0.81, z - 0.23] },
    );
  }
  return parts;
}

function wagon(color: string, index: number): ColoredPart[] {
  const parts: ColoredPart[] = [
    { geometry: rbox(2.5, 0.24, 4, 0.08), color: WOOD, position: [0, 0.85, 0] },
    { geometry: rbox(2.4, 0.14, 3.85), color: STRAW, position: [0, 1.03, 0] },
    { geometry: rbox(2.45, 0.5, 0.14), color, position: [0, 1.3, -1.93] },
    { geometry: rbox(2.45, 0.5, 0.14), color, position: [0, 1.3, 1.93] },
    { geometry: box(0.14, 0.14, 3.8), color: '#526053', position: [0, 0.64, 0] },
  ];
  for (const x of [-1.18, 1.18]) {
    for (const y of [1.16, 1.51]) parts.push({ geometry: rbox(0.12, 0.14, 4), color, position: [x, y, 0] });
    for (const z of [-1.85, 0, 1.85]) parts.push({ geometry: box(0.12, 0.7, 0.12), color: WOOD, position: [x, 1.26, z] });
    for (const z of [-1.23, 1.23]) parts.push(...toyWheel(x, z, 0.56, 0.27, '#f4d977'));
  }
  for (const z of [-1.05, 0.15, 1.35]) {
    parts.push({ geometry: rbox(1.95, 0.24, 0.65), color: STRAW, position: [0, 1.32, z] });
    for (const side of [-1, 1]) {
      const n = index * 2 + (side > 0 ? 1 : 0) + Math.round(z + 1.05);
      parts.push(...visitor(side * 0.62, z, ['#e36b41', '#429baf', '#b35883', '#6fa04c'][n % 4],
        ['#edba88', '#b87954', '#f6d1a5'][n % 3], ['#ecb83f', '#bd6243', '#477b82'][n % 3]));
    }
  }
  return parts;
}

/** A dirt oval, autumn decorations and an articulated tractor train; all meshes are pooled. */
export function harvestRide(): PropModel {
  const body: ColoredPart[] = [];
  const length = 4 * HALF_STRAIGHT + 2 * Math.PI * RADIUS;
  const positions: number[] = [];
  const indices: number[] = [];
  const pose = { x: 0, z: 0, yaw: 0 };
  for (let i = 0; i <= 96; i++) {
    circuitPose(i / 96 * length, RADIUS, HALF_STRAIGHT, pose);
    for (const offset of [-1.9, 1.9]) positions.push(pose.x + Math.cos(pose.yaw) * offset, 0.18,
      pose.z - Math.sin(pose.yaw) * offset);
    if (i < 96) {
      const n = i * 2;
      indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
  }
  const track = new THREE.BufferGeometry();
  track.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  track.setIndex(indices);
  track.computeVertexNormals();
  body.push({ geometry: track, color: '#b18452' });
  // An open frontage: decorations stay inside the oval, away from the tractor.
  for (const z of [-8, -4, 4, 8]) {
    body.push({ geometry: rbox(2.3, 0.9, 1.1), color: STRAW, position: [0, 0.45, z] });
    for (const x of [-0.7, 0.6]) {
      body.push({ geometry: ico(0.43, 1), color: '#ef8a2e', position: [x, 1.22, z], scale: [1, 0.8, 1] },
        { geometry: cyl(0.04, 0.06, 0.16, 6), color: '#688040', position: [x, 1.61, z] });
    }
  }
  for (const x of [-4, 4]) body.push({ geometry: cyl(0.07, 0.08, 3.6, 8), color: WOOD, position: [x, 1.8, 0] });
  body.push({ geometry: box(8, 0.04, 0.04), color: '#eedab4', position: [0, 3.4, 0] });
  for (let i = 0; i < 9; i++) body.push({ geometry: cyl(0.29, 0.29, 0.04, 3),
    color: ['#df7041', '#efc454', '#4e9b8a'][i % 3], position: [-3.4 + i * 0.85, 3.12, 0], rotation: [Math.PI / 2, 0, Math.PI] });

  const animated = (parts: ColoredPart[], behind: number, towTo?: number): PartModel => ({
    geometry: buildColoredGeometry(parts), pivot: [0, towTo === undefined ? 0.2 : 0.85, 0],
    anim: { type: 'circuit', radius: RADIUS, halfStraight: HALF_STRAIGHT, period: PERIOD, behind, towTo } satisfies PartAnim,
  });
  const tractor = tractorParts().filter((p) => p.color !== TOY.GLASS_DARK);
  for (const x of [-0.62, 0.62]) for (const z of [0.27, 1.43]) {
    tractor.push({ geometry: box(0.08, 1.1, 0.08), color: '#325d39', position: [x, 2.2, z] });
  }
  tractor.push(...visitor(0, 0.85, '#df763c', '#e9bb8f', '#edc569', 1.68),
    { geometry: rbox(0.9, 0.08, 0.5), color: TOY.DARK, position: [0, 1.89, 0.27], rotation: [-0.4, 0, 0] },
    { geometry: box(0.12, 0.12, 0.5), color: '#526053', position: [0, 0.65, 1.65] });
  const parts = [animated(tractor, 0)];
  for (let i = 0; i < 3; i++) {
    parts.push(animated(wagon(['#e77939', '#d6a137', '#659875'][i], i), (i + 1) * SPACING));
    parts.push(animated([{ geometry: box(0.13, 0.13, 1), color: '#526053' }], (i + 1) * SPACING, SPACING));
  }
  return { body: buildColoredGeometry(body), parts, placementExclusion: [40, 60] };
}
