import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { box, buildColoredGeometry, cone, cyl, extrudeProfile, ico, prism, rbox, type ColoredPart } from './geometry';
import type { PartAnim, PartModel, PropModel } from './props';

const SNOW = '#fffdf8';
const ICE = '#aad9ed';
const WOOD = '#966644';
const DARK = '#354251';
const STEEL = '#75869a';
const SKIN = '#ffcf9c';

function model(parts: ColoredPart[], extra: Omit<PropModel, 'body'> = {}): PropModel {
  return { body: buildColoredGeometry(parts), ...extra };
}

/** Input geometry is already in part-local coordinates. */
function animated(parts: ColoredPart[], pivot: [number, number, number], anim: PartAnim, unlit = false): PartModel {
  return { geometry: buildColoredGeometry(parts), pivot, anim, unlit };
}

function beam(from: [number, number, number], to: [number, number, number], width: number, color: string): ColoredPart {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const direction = b.clone().sub(a);
  const geometry = cyl(width, width, direction.length(), 6);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
  return { geometry, color, position: a.add(b).multiplyScalar(0.5).toArray() as [number, number, number] };
}

function pineParts(x = 0, y = 0, z = 0, scale = 1): ColoredPart[] {
  const parts: ColoredPart[] = [{ geometry: cyl(0.22 * scale, 0.3 * scale, 1.7 * scale), color: WOOD,
    position: [x, y + 0.85 * scale, z] }];
  for (let tier = 0; tier < 3; tier++) {
    const radius = (1.7 - tier * 0.42) * scale;
    const height = (2.8 - tier * 0.3) * scale;
    const base = y + (1 + tier * 1.4) * scale;
    parts.push(
      { geometry: cone(radius, height, 8), color: '#316757', position: [x, base + height / 2, z] },
      { geometry: cone(radius * 0.83, height * 0.8, 8), color: SNOW, position: [x, base + height * 0.6 + 0.08, z] },
    );
  }
  return parts;
}

export const snowPine = (): PropModel => model(pineParts());

export function snowbank(): PropModel {
  return model([
    { geometry: ico(1.6, 1), color: SNOW, position: [0, 0.25, 0], scale: [1, 0.35, 0.55] },
    { geometry: ico(1, 1), color: '#e3edf6', position: [1.2, 0.2, 0.2], scale: [1, 0.4, 0.65] },
  ]);
}

export function chalet(): PropModel {
  const body: ColoredPart[] = [
    { geometry: rbox(7, 3, 6, 0.15), color: WOOD, position: [0, 1.5, 0] },
    { geometry: prism(7, 2, 6), color: '#b07b52', position: [0, 3, 0] },
    { geometry: prism(8.3, 2.4, 7.3), color: SNOW, position: [0, 3.05, 0] },
    { geometry: box(1.2, 2.2, 0.15), color: '#603e2b', position: [0, 1.1, -3.06] },
    { geometry: rbox(1, 2, 0.9, 0.05), color: '#978e8d', position: [2, 4.7, 0.8] },
    { geometry: rbox(1.2, 0.2, 1.1), color: SNOW, position: [2, 5.7, 0.8] },
    { geometry: rbox(7.7, 0.2, 2, 0.08), color: SNOW, position: [0, 0.13, -3.6] },
  ];
  for (const x of [-2.2, 2.2]) {
    body.push({ geometry: box(1.7, 1.6, 0.15), color: '#593e35', position: [x, 1.8, -3.07] });
    body.push({ geometry: box(0.07, 1.45, 0.1), color: WOOD, position: [x, 1.8, -3.21] });
    body.push({ geometry: box(1.5, 0.07, 0.1), color: WOOD, position: [x, 1.8, -3.21] });
  }
  const windows = animated([-2.2, 2.2].map((x) => ({ geometry: box(1.45, 1.35, 0.06), color: '#ffd77d',
    position: [x, 1.8, -3.16] })), [0, 0, 0], { type: 'swing', axis: 'y', amplitude: 0, speed: 0 }, true);
  const smoke = animated([
    { geometry: ico(0.35, 1), color: '#f5f5f6' },
    { geometry: ico(0.48, 1), color: '#eef1f4', position: [0.3, 0.7, 0] },
    { geometry: ico(0.65, 1), color: '#e8edf2', position: [0.5, 1.5, 0.1] },
  ], [2, 5.95, 0.8], { type: 'slide', vector: [0.6, 1.7, 0], period: 8 });
  return model(body, { parts: [windows, smoke], placementExclusion: [9, 9] });
}

export function snowman(): PropModel {
  const parts: ColoredPart[] = [];
  for (const [radius, y] of [[0.75, 0.65], [0.55, 1.65], [0.4, 2.42]]) {
    parts.push({ geometry: ico(radius, 1), color: SNOW, position: [0, y, 0] });
  }
  parts.push(
    { geometry: cyl(0.48, 0.48, 0.09), color: DARK, position: [0, 2.8, 0] },
    { geometry: cyl(0.28, 0.28, 0.5), color: DARK, position: [0, 3.05, 0] },
    { geometry: cyl(0.55, 0.55, 0.12), color: '#e35154', position: [0, 1.96, 0] },
    { geometry: box(0.18, 0.6, 0.1), color: '#e35154', position: [0.25, 1.65, -0.55] },
    { geometry: cone(0.09, 0.45, 8), color: '#ff983c', position: [0, 2.42, -0.5], rotation: [-Math.PI / 2, 0, 0] },
    beam([-0.45, 1.65, 0], [-1.25, 2.1, 0], 0.04, WOOD),
    beam([0.45, 1.65, 0], [1.25, 1.9, 0], 0.04, WOOD),
  );
  for (const x of [-0.13, 0.13]) parts.push({ geometry: ico(0.05), color: DARK, position: [x, 2.53, -0.35] });
  for (const y of [1.5, 1.75]) parts.push({ geometry: ico(0.055), color: DARK, position: [0, y, -0.55] });
  return model(parts);
}

function person(color: string, skiing = false): ColoredPart[] {
  const parts: ColoredPart[] = [
    { geometry: rbox(0.55, 0.65, 0.38, 0.09), color, position: [0, 0.97, 0] },
    { geometry: ico(0.23, 1), color: SKIN, position: [0, 1.5, -0.04] },
    { geometry: ico(0.25, 1), color: '#ffd448', position: [0, 1.64, 0.02], scale: [1, 0.7, 1] },
    { geometry: rbox(0.37, 0.13, 0.05), color: DARK, position: [0, 1.53, -0.25] },
  ];
  for (const x of [-0.18, 0.18]) {
    parts.push({ geometry: rbox(0.16, 0.52, 0.17), color: '#354963', position: [x, 0.42, 0] });
    parts.push({ geometry: rbox(0.22, 0.17, 0.4), color: DARK, position: [x, 0.12, -0.08] });
    parts.push({ geometry: rbox(skiing ? 0.18 : 0.035, 0.04, skiing ? 2 : 0.5), color: skiing ? '#ed7850' : '#bbcbd9',
      position: [x, 0.025, skiing ? -0.12 : -0.08] });
    parts.push(beam([x * 1.8, 1.2, 0], [x * 2.5, 0.8, -0.25], 0.08, color));
    if (skiing) parts.push(beam([x * 2.5, 0.85, -0.25], [x * 3, 0.03, 0.3], 0.025, DARK));
  }
  return parts;
}

function chair(x: number, z: number, facing: number): ColoredPart[] {
  const y = 5 + z / 2;
  const parts: ColoredPart[] = [
    { geometry: rbox(1.8, 0.15, 0.7), color: '#e45853', position: [x, y, z] },
    { geometry: rbox(1.8, 0.8, 0.12), color: '#e45853', position: [x, y + 0.4, z + facing * 0.3] },
    beam([x - 0.8, y, z], [x - 0.8, y + 1.4, z], 0.045, STEEL),
    beam([x + 0.8, y, z], [x + 0.8, y + 1.4, z], 0.045, STEEL),
    beam([x - 0.8, y + 1.4, z], [x + 0.8, y + 1.4, z], 0.045, STEEL),
    beam([x, y + 1.4, z], [x, y + 3, z], 0.06, STEEL),
    { geometry: rbox(0.5, 0.6, 0.35), color: '#387cce', position: [x, y + 0.43, z] },
    { geometry: ico(0.23, 1), color: SKIN, position: [x, y + 0.98, z] },
    { geometry: ico(0.25), color: '#ffd448', position: [x, y + 1.1, z] },
  ];
  for (const dx of [-0.17, 0.17]) {
    parts.push(beam([x + dx, y + 0.02, z - facing * 0.2], [x + dx, y - 0.55, z - facing * 0.5], 0.09, DARK));
    parts.push({ geometry: rbox(0.15, 0.06, 1.6), color: '#ffd448', position: [x + dx, y - 0.6, z - facing * 0.6] });
  }
  return parts;
}

export function skiSlope(): PropModel {
  const slopeAngle = Math.atan(0.5);
  const body: ColoredPart[] = [
    { geometry: extrudeProfile([[0, 0], [44, 0], [44, 22]], 24), color: '#d9e8f3', rotation: [0, -Math.PI / 2, 0] },
    { geometry: rbox(24, 0.35, Math.hypot(44, 22), 0.08), color: SNOW, position: [0, 11.1, 22], rotation: [-slopeAngle, 0, 0] },
  ];
  // Snow-covered side slopes meet the ground instead of exposing tall vertical walls.
  for (const side of [-1, 1]) body.push({
    geometry: new ConvexGeometry([[12, 0, 0], [20, 0, 0], [20, 0, 44], [12, 0, 44], [12, 22, 44]]
      .map(([x, y, z]) => new THREE.Vector3(side * x, y, z))), color: '#eaf0f5',
  });
  for (const z of [6, 16, 26, 36]) {
    for (const x of [-7, 7]) {
      body.push({ geometry: cyl(0.05, 0.05, 1.7, 6), color: STEEL, position: [x, z / 2 + 0.95, z] });
      body.push({ geometry: box(0.9, 0.6, 0.06), color: z % 20 === 6 ? '#ef6155' : '#399adb', position: [x + 0.4, z / 2 + 1.45, z] });
    }
  }
  for (const z of [8, 26, 42]) {
    const height = 8 + z / 2;
    body.push(beam([-13, Math.max(0, z / 2 - 2.75), z], [-13, height, z], 0.2, STEEL));
    body.push({ geometry: rbox(3.5, 0.25, 0.3), color: DARK, position: [-13, height, z] });
  }
  for (const x of [-14, -12]) body.push(beam([x, 8, 0], [x, 30, 44], 0.045, DARK));
  for (const z of [0, 44]) {
    const y = z / 2;
    if (z > 0) body.push({ geometry: box(7, 5, 7), color: '#d9e8f3', position: [-13, y - 2.5, z] });
    body.push({ geometry: rbox(7, 5.5, 7, 0.2), color: '#9b6650', position: [-13, y + 2.75, z] });
    body.push({ geometry: prism(8, 2, 8), color: SNOW, position: [-13, y + 5.5, z] });
    body.push({ geometry: box(5.5, 2, 0.1), color: '#74aeca', position: [-13, y + 3.4, z - 3.55] });
  }
  for (const [x, z] of [[10, 8], [10, 25], [10, 38], [-18, 16]]) {
    const ground = Math.max(0, z / 2 - 2.75 * Math.max(0, Math.abs(x) - 12));
    body.push(...pineParts(x, ground, z, 1.1));
  }
  const parts: PartModel[] = [];
  for (const [i, color] of ['#e45853', '#3b8ddb', '#8d5ec3'].entries()) {
    const skier = animated(person(color, true), [-4 + i * 4, 20.2, 40],
      { type: 'slide', vector: [i === 1 ? 1.5 : -1.5, -18, -36], period: 13 + i * 2 });
    skier.geometry.rotateX(-slopeAngle);
    parts.push(skier);
  }
  // Each entire queue moves one chair spacing. Identical neighbours replace one another
  // on wrap; the lowest/highest chair disappears inside the station roofs.
  parts.push(animated([0, 14, 28].flatMap((z) => chair(-14, z, 1)), [0, 0, 0],
    { type: 'slide', vector: [0, 7, 14], period: 9 }));
  parts.push(animated([14, 28, 42].flatMap((z) => chair(-12, z, -1)), [0, 0, 0],
    { type: 'slide', vector: [0, -7, -14], period: 9 }));
  return model(body, { parts, placementExclusion: [44, 104] });
}

export function iceRink(): PropModel {
  const body: ColoredPart[] = [
    { geometry: cyl(11, 11, 0.18, 32), color: ICE, position: [0, 0.12, 0], scale: [1, 1, 0.7] },
    { geometry: new THREE.TorusGeometry(11, 0.28, 5, 32), color: SNOW, position: [0, 0.25, 0],
      rotation: [Math.PI / 2, 0, 0], scale: [1, 0.7, 1] },
  ];
  for (const x of [-8.3, 8.3]) {
    body.push(beam([x, 0.25, -1.2], [x, 1.6, -1.2], 0.065, '#e05a52'));
    body.push(beam([x, 0.25, 1.2], [x, 1.6, 1.2], 0.065, '#e05a52'));
    body.push(beam([x, 1.6, -1.2], [x, 1.6, 1.2], 0.065, '#e05a52'));
    const backX = x + Math.sign(x) * 0.7;
    for (const z of [-1.2, -0.6, 0, 0.6, 1.2]) {
      body.push(beam([backX, 0.25, z], [backX, 1.5, z], 0.015, '#eef8ff'));
    }
    for (const y of [0.3, 0.7, 1.1, 1.5]) body.push(beam([backX, y, -1.2], [backX, y, 1.2], 0.015, '#eef8ff'));
  }
  body.push(...pineParts(-11, 0, 5), ...pineParts(10, 0, 6));
  return model(body, {
    parts: [
      animated(person('#e65b76'), [0, 0.23, 0], { type: 'orbit', radius: [5, 3], period: 18 }),
      animated(person('#3899a6'), [0, 0.23, 0], { type: 'orbit', radius: [6.5, 4.5], period: 24 }),
    ],
    placementExclusion: [28, 23],
  });
}

export function sledHill(): PropModel {
  const slope = 5 / 18;
  const body: ColoredPart[] = [
    { geometry: extrudeProfile([[0, 0], [18, 0], [18, 5]], 12), color: '#d8e7f2', rotation: [0, -Math.PI / 2, 0] },
    { geometry: rbox(12, 0.28, Math.hypot(18, 5)), color: SNOW, position: [0, 2.58, 9], rotation: [-Math.atan(slope), 0, 0] },
    ...pineParts(-8, 0, 10), ...pineParts(8, 0, 14),
  ];
  const sled = animated([
    { geometry: rbox(0.9, 0.18, 1.6), color: '#f26c52', position: [0, 0.18, 0] },
    { geometry: rbox(0.15, 0.15, 1.7), color: WOOD, position: [-0.35, 0.04, 0] },
    { geometry: rbox(0.15, 0.15, 1.7), color: WOOD, position: [0.35, 0.04, 0] },
    { geometry: rbox(0.5, 0.55, 0.35), color: '#795dcc', position: [0, 0.55, 0.2] },
    { geometry: ico(0.22, 1), color: SKIN, position: [0, 1, 0.1] },
    { geometry: ico(0.24), color: '#45a8c3', position: [0, 1.13, 0.13] },
  ], [0, 16 * slope + 0.18, 16], { type: 'slide', vector: [0, -14 * slope, -14], period: 7 });
  sled.geometry.rotateX(-Math.atan(slope));
  return model(body, { parts: [sled], placementExclusion: [22, 42] });
}

export function snowFort(): PropModel {
  const parts: ColoredPart[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      if (row === 2 && col % 2) continue;
      parts.push({ geometry: rbox(0.8, 0.5, 0.7, 0.07), color: row % 2 ? '#e7eff7' : SNOW,
        position: [(col - 2) * 0.83, 0.25 + row * 0.51, 0] });
    }
  }
  for (const x of [-1.75, 1.75]) parts.push({ geometry: rbox(0.7, 1, 1.8), color: SNOW, position: [x, 0.5, 1] });
  parts.push({ geometry: ico(0.2, 1), color: SNOW, position: [0.5, 0.2, 1.4] });
  return model(parts);
}

export function fox(): PropModel {
  const head: ColoredPart[] = [
    { geometry: ico(0.28, 1), color: '#e78b3d' },
    { geometry: cone(0.2, 0.4, 6), color: '#fff1d6', position: [0, -0.07, -0.25], rotation: [-Math.PI / 2, 0, 0] },
    { geometry: ico(0.045), color: DARK, position: [0, -0.07, -0.46] },
  ];
  for (const x of [-0.16, 0.16]) {
    head.push({ geometry: cone(0.12, 0.34, 5), color: '#bd612c', position: [x, 0.28, 0] });
    head.push({ geometry: ico(0.035), color: DARK, position: [x, 0.03, -0.22] });
  }
  const body: ColoredPart[] = [
    { geometry: ico(0.47, 1), color: '#e88e3e', position: [0, 0.57, 0], scale: [0.6, 0.75, 1.3] },
    { geometry: ico(0.37, 1), color: '#d97932', position: [0.1, 0.52, 0.75], scale: [0.7, 0.7, 1.6] },
    { geometry: ico(0.23, 1), color: '#fff4df', position: [0.1, 0.52, 1.2], scale: [0.8, 0.8, 1.1] },
  ];
  for (const x of [-0.18, 0.18]) for (const z of [-0.32, 0.32]) {
    body.push({ geometry: rbox(0.12, 0.4, 0.12), color: '#5d453b', position: [x, 0.2, z] });
  }
  return model(body, { parts: [animated(head, [0, 0.84, -0.55], { type: 'swing', axis: 'y', amplitude: 0.2, speed: 0.7 })] });
}

export function hare(): PropModel {
  const head: ColoredPart[] = [{ geometry: ico(0.22, 1), color: SNOW }];
  for (const x of [-0.11, 0.11]) {
    head.push({ geometry: rbox(0.12, 0.65, 0.14, 0.05), color: SNOW, position: [x, 0.43, 0.02], rotation: [0, 0, x] });
    head.push({ geometry: box(0.055, 0.45, 0.02), color: '#f1c4c6', position: [x, 0.43, -0.07], rotation: [0, 0, x] });
    head.push({ geometry: ico(0.03), color: DARK, position: [x, 0.04, -0.17] });
  }
  head.push({ geometry: ico(0.035), color: '#ce9196', position: [0, -0.04, -0.22] });
  return model([
    { geometry: ico(0.36, 1), color: '#edf3fa', position: [0, 0.32, 0.1], scale: [0.8, 0.9, 1.1] },
    { geometry: ico(0.14, 1), color: SNOW, position: [0, 0.35, 0.47] },
    ...[-0.18, 0.18].map((x): ColoredPart => ({ geometry: rbox(0.19, 0.13, 0.46), color: SNOW, position: [x, 0.07, 0] })),
  ], { parts: [animated(head, [0, 0.6, -0.24], { type: 'swing', axis: 'y', amplitude: 0.18, speed: 1.1 })] });
}
