import * as THREE from 'three';
import { box, buildColoredGeometry, cone, cyl, extrudeProfile, ico, rbox, type ColoredPart } from './geometry';
import type { PropModel } from './props';

const WOOD = '#98643e';
const STRAW = '#e0b85c';
const LEAVES = ['#df8a36', '#edb449', '#c85c38', '#d7a13d'];
const PUMPKINS = ['#ed8b2e', '#e97525', '#f2a13c', '#dfa943'];

const model = (parts: ColoredPart[], extra: Omit<PropModel, 'body'> = {}): PropModel => ({
  body: buildColoredGeometry(parts), ...extra,
});

/** Squashed, eight-ribbed pumpkins; the stem and leaf make the silhouette readable. */
function pumpkin(x: number, y: number, z: number, radius: number, color = PUMPKINS[0]): ColoredPart[] {
  const geometry = new THREE.SphereGeometry(radius, 16, 8);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const angle = Math.atan2(positions.getZ(i), positions.getX(i));
    const rib = 0.94 + 0.06 * Math.cos(angle * 8);
    positions.setXYZ(i, positions.getX(i) * rib, positions.getY(i) * 0.75, positions.getZ(i) * rib);
  }
  return [
    { geometry, color, position: [x, y + radius * 0.77, z] },
    { geometry: cyl(radius * 0.06, radius * 0.09, radius * 0.34, 6), color: '#6c773b',
      position: [x + radius * 0.035, y + radius * 1.6, z], rotation: [0, 0, -0.22] },
    { geometry: ico(radius * 0.18), color: '#84914b', position: [x + radius * 0.2, y + radius * 1.56, z], scale: [1.4, 0.2, 0.7] },
  ];
}

function fallenLeaves(x = 0, z = 0): ColoredPart[] {
  return Array.from({ length: 14 }, (_, i): ColoredPart => {
    const angle = i * 2.399;
    const radius = 0.3 + (i % 5) * 0.25;
    return { geometry: ico(0.2), color: LEAVES[i % LEAVES.length],
      position: [x + Math.cos(angle) * radius, 0.065 + (i % 3) * 0.02, z + Math.sin(angle) * radius],
      scale: [1.3, 0.12, 0.8], rotation: [0, angle, 0] };
  });
}

export function autumnTree(): PropModel {
  const parts: ColoredPart[] = [
    { geometry: cyl(0.24, 0.4, 3.8, 8), color: WOOD, position: [0, 1.9, 0] },
    { geometry: cyl(0.12, 0.2, 1.8, 6), color: WOOD, position: [-0.5, 3, 0], rotation: [0, 0, 0.7] },
    { geometry: cyl(0.12, 0.2, 1.8, 6), color: WOOD, position: [0.5, 3.2, 0.1], rotation: [0, 0, -0.6] },
    { geometry: ico(1.9, 1), color: LEAVES[0], position: [0, 4.7, 0], scale: [1.1, 1.15, 1] },
    { geometry: ico(1.35, 1), color: LEAVES[1], position: [-1.2, 4.2, 0.15] },
    { geometry: ico(1.25, 1), color: LEAVES[2], position: [1.1, 4.4, -0.3] },
    { geometry: ico(1.15, 1), color: LEAVES[3], position: [0.25, 5.55, 0.1] },
    ...fallenLeaves(),
  ];
  return model(parts);
}

export function leafPile(): PropModel {
  return model([
    { geometry: ico(0.95, 1), color: LEAVES[0], position: [0, 0.18, 0], scale: [1.3, 0.3, 0.8] },
    { geometry: ico(0.5, 1), color: LEAVES[1], position: [-0.45, 0.22, 0], scale: [1, 0.45, 0.9] },
    { geometry: ico(0.45, 1), color: LEAVES[2], position: [0.45, 0.17, 0.15], scale: [1, 0.35, 0.8] },
    ...fallenLeaves(),
  ]);
}

export function pumpkinPile(): PropModel {
  return model([
    ...pumpkin(0, 0.02, 0, 0.8),
    ...pumpkin(-1.1, 0.02, 0.3, 0.5, PUMPKINS[1]),
    ...pumpkin(1, 0.02, 0.3, 0.55, PUMPKINS[2]),
    ...pumpkin(0.3, 0.02, -0.85, 0.4, PUMPKINS[3]),
  ]);
}

/** Friendly fabric face and straw hat, without Halloween features. */
function scarecrowParts(x = 0, z = 0): ColoredPart[] {
  const parts: ColoredPart[] = [
    { geometry: cyl(0.075, 0.1, 2.8, 6), color: WOOD, position: [x, 1.4, z] },
    { geometry: rbox(0.8, 0.8, 0.4), color: '#54888e', position: [x, 1.93, z] },
    { geometry: box(2.2, 0.12, 0.12), color: WOOD, position: [x, 2.08, z] },
    { geometry: ico(0.36, 1), color: '#f2d3a0', position: [x, 2.72, z] },
    { geometry: cyl(0.55, 0.55, 0.1, 12), color: STRAW, position: [x, 3.02, z] },
    { geometry: cyl(0.26, 0.32, 0.36, 10), color: STRAW, position: [x, 3.24, z] },
    { geometry: cyl(0.31, 0.32, 0.08, 10), color: '#a26b3f', position: [x, 3.1, z] },
    { geometry: rbox(0.35, 0.14, 0.07), color: '#d76b40', position: [x, 2.44, z - 0.25] },
    { geometry: cone(0.07, 0.2, 6), color: '#d7814a', position: [x, 2.72, z - 0.38], rotation: [-Math.PI / 2, 0, 0] },
  ];
  for (const side of [-1, 1]) {
    parts.push({ geometry: rbox(0.65, 0.27, 0.3), color: '#b05d3c', position: [x + side * 0.63, 2.08, z], rotation: [0, 0, side * 0.07] });
    parts.push({ geometry: rbox(0.22, 0.5, 0.27), color: '#54888e', position: [x + side * 0.22, 1.33, z], rotation: [0, 0, side * 0.12] });
    parts.push({ geometry: ico(0.045), color: '#4b3c35', position: [x + side * 0.13, 2.8, z - 0.33] });
    for (let i = 0; i < 3; i++) parts.push({ geometry: box(0.035, 0.035, 0.045), color: '#7c513d',
      position: [x + side * (0.06 + i * 0.05), 2.6 + i * 0.025, z - 0.3] });
    for (let i = 0; i < 4; i++) {
      parts.push({ geometry: cyl(0.017, 0.025, 0.33, 4), color: STRAW, position: [x + side * (0.95 + i * 0.05), 1.98 + i * 0.06, z], rotation: [0, 0, side * 0.85] });
      parts.push({ geometry: cyl(0.018, 0.025, 0.28, 4), color: STRAW, position: [x + side * 0.22 + (i - 1.5) * 0.04, 1.03, z] });
    }
  }
  return parts;
}

export const scarecrow = (): PropModel => model(scarecrowParts());

export function pumpkinPatch(): PropModel {
  const parts: ColoredPart[] = [
    { geometry: rbox(20, 0.08, 16, 0.04), color: '#a37951', position: [0, 0.085, 0] },
  ];
  for (let row = 0; row < 4; row++) {
    const z = -5.2 + row * 3.4;
    parts.push({ geometry: rbox(17.7, 0.12, 1.5, 0.05), color: '#866242', position: [0, 0.16, z] });
    for (let col = 0; col < 6; col++) {
      const x = -8 + col * 3.2;
      const radius = 0.6 + ((row * 7 + col * 3) % 5) * 0.055;
      parts.push(...pumpkin(x, 0.22, z + Math.sin(col * 2 + row) * 0.18, radius, PUMPKINS[(row + col) % 4]));
      parts.push({ geometry: rbox(1.3, 0.035, 0.09), color: '#778649', position: [x + 0.8, 0.24, z], rotation: [0, 0.3, 0] });
      parts.push({ geometry: ico(0.2), color: '#899150', position: [x + 0.65, 0.27, z + 0.3], scale: [1.4, 0.1, 0.8] });
    }
  }
  // Open entry arch: a large pumpkin emblem and colourful harvest bunting.
  for (const x of [-4.5, 4.5]) parts.push({ geometry: rbox(0.2, 3.5, 0.2), color: WOOD, position: [x, 1.75, -7.6] });
  parts.push({ geometry: rbox(9.3, 0.22, 0.22), color: WOOD, position: [0, 3.5, -7.6] });
  parts.push(...pumpkin(0, 3.58, -7.6, 0.75));
  for (let i = 0; i < 10; i++) parts.push({
    geometry: extrudeProfile([[-0.3, 0], [0.3, 0], [0, -0.55]], 0.045), color: i % 2 ? '#edd16f' : '#be6545',
    position: [-4 + i * 0.89, 3.38, -7.62],
  });
  parts.push(...scarecrowParts(0, 6.7));
  for (const x of [-8, 8]) {
    parts.push({ geometry: rbox(1.6, 0.85, 1.1), color: STRAW, position: [x, 0.53, -7.2] });
    parts.push({ geometry: rbox(0.12, 0.89, 1.14), color: '#b79645', position: [x - 0.4, 0.53, -7.2] });
    parts.push({ geometry: rbox(0.12, 0.89, 1.14), color: '#b79645', position: [x + 0.4, 0.53, -7.2] });
    parts.push(...pumpkin(x, 0.96, -7.2, 0.45, PUMPKINS[1]));
  }
  return model(parts, { placementExclusion: [26, 23] });
}

export function harvestStand(): PropModel {
  const parts: ColoredPart[] = [
    { geometry: rbox(5.4, 1, 1.7), color: WOOD, position: [0, 0.7, 0] },
    { geometry: rbox(5.7, 0.15, 2), color: '#d4a368', position: [0, 1.27, 0] },
  ];
  for (const x of [-2.6, 2.6]) for (const z of [-0.85, 0.85]) {
    parts.push({ geometry: rbox(0.13, 3.1, 0.13), color: WOOD, position: [x, 1.55, z] });
  }
  for (let i = 0; i < 10; i++) {
    parts.push({ geometry: rbox(0.6, 0.14, 2.9), color: i % 2 ? '#f4dfac' : '#b9573d', position: [-2.7 + i * 0.6, 3.14, 0], rotation: [-0.08, 0, 0] });
    parts.push({ geometry: rbox(0.6, 0.4, 0.12), color: i % 2 ? '#f4dfac' : '#b9573d', position: [-2.7 + i * 0.6, 2.94, -1.45] });
  }
  for (const x of [-1.8, 0, 1.8]) {
    parts.push({ geometry: rbox(1.35, 0.22, 1.1), color: '#b88750', position: [x, 1.46, 0] });
    parts.push({ geometry: box(1.35, 0.32, 0.08), color: '#d5a56c', position: [x, 1.57, -0.52] });
    parts.push({ geometry: box(1.35, 0.32, 0.08), color: '#d5a56c', position: [x, 1.57, 0.52] });
    if (x < 0) parts.push(...pumpkin(x, 1.57, 0, 0.4));
    else for (let i = 0; i < 6; i++) {
      const fx = x - 0.38 + (i % 3) * 0.38;
      const fz = -0.2 + Math.floor(i / 3) * 0.4;
      parts.push({ geometry: ico(0.19, 1), color: x ? '#a7b34f' : '#c94f38',
        position: [fx, 1.76, fz], scale: x ? [0.9, 1.3, 0.9] : [1, 1, 1] });
      parts.push({ geometry: cyl(0.02, 0.025, 0.1, 4), color: WOOD, position: [fx, x ? 2.02 : 1.97, fz] });
    }
  }
  parts.push(...pumpkin(-3.9, 0.03, -0.45, 0.75));
  parts.push(...pumpkin(3.7, 0.03, -0.4, 0.55, PUMPKINS[2]));
  parts.push({ geometry: rbox(1.1, 0.8, 1.2), color: STRAW, position: [-3.8, 0.45, 0.95] });
  return model(parts, { placementExclusion: [12, 9] });
}

export function cornRows(): PropModel {
  const parts: ColoredPart[] = [];
  for (let row = 0; row < 3; row++) {
    const z = -2.1 + row * 2.1;
    parts.push({ geometry: rbox(6.4, 0.08, 0.8), color: '#9b7651', position: [0, 0.085, z] });
    for (let col = 0; col < 5; col++) {
      const x = -2.6 + col * 1.3;
      const h = 2.3 + (col % 3) * 0.15;
      parts.push({ geometry: cyl(0.035, 0.065, h, 5), color: '#ae9650', position: [x, h / 2 + 0.12, z] });
      for (const side of [-1, 1]) {
        parts.push({ geometry: box(0.07, 0.75, 0.2), color: '#ada555', position: [x + side * 0.24, 1.3, z], rotation: [0, 0, -side * 0.7] });
        parts.push({ geometry: ico(0.16), color: '#e6bc56', position: [x + side * 0.1, 1.6, z], scale: [0.65, 2, 0.65] });
      }
      parts.push({ geometry: cone(0.14, 0.5, 5), color: STRAW, position: [x, h + 0.2, z] });
    }
  }
  return model(parts, { placementExclusion: [8, 7] });
}
