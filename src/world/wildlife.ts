import * as THREE from 'three';
import { box, buildColoredGeometry, cone, cyl, ico, rbox, type ColoredPart } from './geometry';
import type { PropModel } from './props';

export type WildlifeKind = 'elk' | 'moose' | 'bear' | 'bighorn' | 'wolf';

/** Original rounded toy animals; all face -Z with hooves/paws on the ground. */
export function animalParts(kind: WildlifeKind): { body: ColoredPart[]; head: ColoredPart[]; pivot: [number, number, number] } {
  const bear = kind === 'bear';
  const wolf = kind === 'wolf';
  const moose = kind === 'moose';
  const ram = kind === 'bighorn';
  const color = bear ? '#805336' : wolf ? '#879397' : moose ? '#66503b' : ram ? '#b29b7b' : '#bc8953';
  const legHeight = bear ? 0.5 : wolf ? 0.6 : moose ? 1.3 : ram ? 0.7 : 1;
  const bodyY = legHeight + 0.4;
  const width = bear ? 1.3 : wolf ? 0.65 : moose ? 1.1 : 0.85;
  const length = bear ? 2.1 : moose ? 2.4 : 1.8;
  const body: ColoredPart[] = [{ geometry: rbox(width, bear ? 1.2 : 0.9, length, 0.25), color, position: [0, bodyY, 0] }];
  for (const x of [-width * 0.32, width * 0.32]) {
    for (const z of [-length * 0.32, length * 0.32]) {
      body.push({ geometry: cyl(bear ? 0.18 : 0.1, bear ? 0.2 : 0.08, legHeight, 8), color, position: [x, legHeight / 2, z] });
      body.push({ geometry: rbox(bear ? 0.32 : 0.2, 0.14, 0.28, 0.04), color: '#39342f', position: [x, 0.07, z - 0.04] });
    }
  }
  body.push({ geometry: ico(wolf ? 0.24 : 0.15, 1), color: wolf ? '#bcc4c4' : '#ddcfb5', position: [0, bodyY, length / 2], scale: [0.6, wolf ? 0.7 : 1, wolf ? 2.6 : 1] });
  if (bear) body.push({ geometry: ico(0.55, 1), color, position: [0, bodyY + 0.4, -0.6], scale: [1.1, 0.85, 1] });
  const neckY = bodyY + (bear || wolf ? 0.3 : 0.8);
  const headZ = -length / 2 - 0.2;
  const pivot: [number, number, number] = [0, neckY - 0.1, headZ + 0.2];
  const head: ColoredPart[] = [
    { geometry: rbox(bear ? 0.9 : 0.65, bear ? 0.75 : 0.7, 0.75, 0.18), color, position: [0, neckY, headZ] },
    { geometry: rbox(bear ? 0.55 : 0.43, 0.35, moose ? 0.75 : 0.5, 0.1), color: bear ? '#bc9570' : color, position: [0, neckY - 0.14, headZ - 0.45] },
    { geometry: ico(0.11, 1), color: '#2c3031', position: [0, neckY - 0.08, headZ - (moose ? 0.84 : 0.71)], scale: [1.3, 0.75, 0.6] },
  ];
  if (!bear && !wolf) head.push({ geometry: rbox(0.48, 0.95, 0.55, 0.15), color: moose ? '#4c3d32' : '#805534', position: [0, bodyY + 0.38, headZ + 0.3], rotation: [-0.25, 0, 0] });
  for (const side of [-1, 1]) {
    head.push({ geometry: ico(0.07, 1), color: '#26282c', position: [side * (bear ? 0.39 : 0.29), neckY + 0.12, headZ - 0.32] });
    head.push({ geometry: ico(0.022, 0), color: '#ffffff', position: [side * (bear ? 0.42 : 0.32), neckY + 0.14, headZ - 0.35] });
    head.push({ geometry: bear ? ico(0.18, 1) : cone(0.15, wolf ? 0.4 : 0.3, 6), color,
      position: [side * 0.33, neckY + 0.44, headZ + 0.1], rotation: [0, 0, side * -0.3], scale: [1, 1, bear ? 0.55 : 0.65] });
    if (ram) {
      head.push({ geometry: new THREE.TorusGeometry(0.32, 0.1, 6, 16, Math.PI * 1.7), color: '#d3c2a1', position: [side * 0.39, neckY + 0.14, headZ], rotation: [0, Math.PI / 2, 0] });
    }
    if (kind === 'elk' || moose) {
      const antler = '#dcc69d';
      head.push({ geometry: cyl(0.045, 0.075, 0.85, 6), color: antler, position: [side * 0.45, neckY + 0.75, headZ + 0.16], rotation: [0.25, 0, -side * 0.5] });
      if (moose) head.push({ geometry: ico(0.48, 0), color: antler, position: [side * 0.7, neckY + 1.05, headZ + 0.3], scale: [1.3, 0.35, 0.8] });
      for (let tine = 0; tine < 3; tine++) head.push({ geometry: cone(0.045, 0.35, 5), color: antler,
        position: [side * (0.5 + tine * 0.11), neckY + 0.65 + tine * 0.22, headZ - 0.05], rotation: [-0.5, 0, side * -0.3] });
    }
  }
  return { body, head, pivot };
}

export function wildlife(kind: WildlifeKind): PropModel {
  const { body, head, pivot } = animalParts(kind);
  const headGeometry = buildColoredGeometry(head);
  headGeometry.translate(-pivot[0], -pivot[1], -pivot[2]);
  return { body: buildColoredGeometry(body), parts: [{ geometry: headGeometry, pivot,
    anim: { type: 'swing', axis: 'y', amplitude: 0.16, speed: 0.5 } }] };
}

/** Broad grass-covered crossing, with a clear arch for the bus and animals above it. */
export function wildlifeBridge(): PropModel {
  const parts: ColoredPart[] = [];
  // One continuous cross-section: road portal below, soil-covered habitat above.
  const profile: [number, number][] = [
    [-32, 0], [-11, 8.25], [11, 8.25], [32, 0], [11, 0], [9, 4.8], [7, 6.5], [-7, 6.5], [-9, 4.8], [-11, 0],
  ];
  const shape = new THREE.Shape(profile.map(([x, y]) => new THREE.Vector2(x, y)));
  const arch = new THREE.ExtrudeGeometry(shape, { depth: 14, bevelEnabled: false });
  arch.translate(0, 0, -7);
  parts.push({ geometry: arch, color: '#a89d86' });
  const turfProfile: [number, number][] = [[-32, 0.2], [-11, 8.5], [11, 8.5], [32, 0.2], [32, 0], [11, 8.25], [-11, 8.25], [-32, 0]];
  const turfShape = new THREE.Shape(turfProfile.map(([x, y]) => new THREE.Vector2(x, y)));
  const turf = new THREE.ExtrudeGeometry(turfShape, { depth: 14.6, bevelEnabled: false });
  turf.translate(0, 0, -7.3);
  parts.push({ geometry: turf, color: '#70934e' });
  // Habitat shrubs and pines soften the ramp edges; central walking strip stays open.
  for (const x of [-25, -18, -10, 10, 18, 25]) {
    const groundY = Math.abs(x) <= 11 ? 8.5 : 8.5 * (32 - Math.abs(x)) / 21;
    for (const z of [-5.5, 5.5]) {
      parts.push({ geometry: ico(1.3, 1), color: '#527941', position: [x, groundY + 0.65, z], scale: [1, 0.7, 1] });
      parts.push({ geometry: cyl(0.16, 0.22, 2, 6), color: '#70543b', position: [x, groundY + 1, z] });
      parts.push({ geometry: cone(1.5, 4, 8), color: '#365f40', position: [x, groundY + 3.2, z] });
    }
  }
  // Low wooden screens along each edge, following the grass slopes.
  for (const z of [-7.2, 7.2]) {
    for (let x = -30; x <= 30; x += 3) {
      const y = Math.abs(x) <= 11 ? 8.5 : 8.5 * (32 - Math.abs(x)) / 21;
      parts.push({ geometry: box(0.14, 1.1, 0.14), color: '#786445', position: [x, y + 0.55, z] });
      if (x < 30) {
        const nextY = Math.abs(x + 3) <= 11 ? 8.5 : 8.5 * (32 - Math.abs(x + 3)) / 21;
        parts.push({ geometry: box(Math.hypot(3, nextY - y), 0.12, 0.12), color: '#9b855d', position: [x + 1.5, (y + nextY) / 2 + 0.95, z], rotation: [0, 0, Math.atan2(nextY - y, 3)] });
      }
    }
  }
  const elk = animalParts('elk');
  return { body: buildColoredGeometry(parts), placementExclusion: [68, 24], parts: [{ geometry: buildColoredGeometry([...elk.body, ...elk.head]),
    pivot: [-8, 8.5, 0], anim: { type: 'crossing', span: 16, period: 36 } }] };
}
