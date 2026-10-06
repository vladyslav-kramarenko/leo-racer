import { box, buildColoredGeometry, cone, cyl, ico, rbox, type ColoredPart } from './geometry';

const DARK = '#30363b';
const STEEL = '#69757c';
const BRASS = '#d9b35d';
const FRONT: [number, number, number] = [Math.PI / 2, 0, 0];
const AXLE: [number, number, number] = [0, 0, Math.PI / 2];

function chassis(length: number): ColoredPart[] {
  const parts: ColoredPart[] = [
    { geometry: box(2.6, 0.35, length), color: DARK, position: [0, 0.65, 0] },
    { geometry: box(0.3, 0.2, length + 0.8), color: STEEL, position: [0, 0.55, 0] },
  ];
  for (const x of [-1.2, 1.2]) {
    for (const z of [-length * 0.3, length * 0.3]) {
      parts.push({ geometry: cyl(0.5, 0.5, 0.28, 12), color: DARK, position: [x, 0.5, z], rotation: AXLE });
    }
  }
  return parts;
}

/** Original toy models inspired by early twentieth-century BC steam freight. */
export function locomotiveGeometry() {
  const parts: ColoredPart[] = [
    { geometry: rbox(2.7, 0.4, 9, 0.12), color: DARK, position: [0, 1, 0] },
    { geometry: cyl(1, 1, 5.6, 16), color: '#3d454a', position: [0, 2.15, -1.1], rotation: FRONT },
    { geometry: cyl(0.95, 0.95, 0.15, 16), color: DARK, position: [0, 2.15, -3.95], rotation: FRONT },
    { geometry: cyl(0.35, 0.25, 1.2, 12), color: DARK, position: [0, 3.25, -3] },
    { geometry: cyl(0.4, 0.4, 0.14, 12), color: BRASS, position: [0, 3.85, -3] },
    { geometry: cyl(0.3, 0.4, 0.65, 12), color: BRASS, position: [0, 3.1, -0.5] },
    { geometry: rbox(2.7, 2.5, 2.5, 0.16), color: '#3c5045', position: [0, 2.4, 3] },
    { geometry: rbox(3, 0.25, 2.9, 0.1), color: DARK, position: [0, 3.75, 3] },
    { geometry: cyl(0.24, 0.24, 0.3, 12), color: '#fff0a7', position: [0, 2.9, -4.1], rotation: FRONT },
    { geometry: cone(1.5, 1, 4), color: STEEL, position: [0, 0.55, -4.7], rotation: [Math.PI / 2, Math.PI / 4, 0], scale: [1, 1, 0.45] },
  ];
  for (const z of [-2.8, -1.1, 0.6]) {
    parts.push({ geometry: cyl(1.025, 1.025, 0.07, 16), color: BRASS, position: [0, 2.15, z], rotation: FRONT });
  }
  for (const x of [-1.37, 1.37]) {
    parts.push({ geometry: rbox(0.05, 1.05, 1.1, 0.05), color: '#9ed8e9', position: [x, 2.9, 2.8] });
    parts.push({ geometry: box(0.2, 0.18, 6), color: STEEL, position: [x, 1.55, -1] });
  }
  for (const x of [-0.9, 0.9]) {
    parts.push({ geometry: cyl(0.35, 0.35, 0.25, 10), color: DARK, position: [x, 0.4, -3.8], rotation: AXLE });
  }
  return buildColoredGeometry(parts);
}

export function driverWheelGeometry() {
  const parts: ColoredPart[] = [
    { geometry: cyl(0.78, 0.78, 0.3, 16), color: DARK, rotation: AXLE },
    { geometry: cyl(0.58, 0.58, 0.32, 16), color: '#855248', rotation: AXLE },
  ];
  for (let spoke = 0; spoke < 4; spoke++) {
    parts.push({ geometry: box(0.34, 1.12, 0.08), color: BRASS, rotation: [spoke * Math.PI / 4, 0, 0] });
  }
  return buildColoredGeometry(parts);
}

export function tenderGeometry() {
  const parts = chassis(6);
  parts.push({ geometry: rbox(2.8, 1.8, 5.7, 0.16), color: '#343d38', position: [0, 1.8, 0] });
  for (let i = 0; i < 8; i++) {
    parts.push({ geometry: ico(0.65), color: '#24282c', position: [(i % 2 ? -0.7 : 0.7), 2.7, -2 + Math.floor(i / 2) * 1.15] });
  }
  return buildColoredGeometry(parts);
}

export function oreWagonGeometry() {
  const parts = chassis(7);
  parts.push({ geometry: box(2.9, 0.3, 6.8), color: '#995e3d', position: [0, 1, 0] });
  for (const x of [-1.4, 1.4]) {
    parts.push({ geometry: rbox(0.18, 1.5, 6.8, 0.04), color: '#a66b48', position: [x, 1.8, 0] });
    for (const z of [-2.5, 0, 2.5]) parts.push({ geometry: box(0.22, 1.55, 0.14), color: STEEL, position: [x, 1.8, z] });
  }
  for (const z of [-3.3, 3.3]) parts.push({ geometry: box(2.9, 1.5, 0.18), color: '#995e3d', position: [0, 1.8, z] });
  for (let i = 0; i < 12; i++) {
    parts.push({ geometry: ico(0.7), color: ['#a49c8d', '#778b76', '#b99468'][i % 3],
      position: [-0.8 + (i % 3) * 0.8, 2.2 + (i % 2) * 0.2, -2.5 + Math.floor(i / 3) * 1.6] });
  }
  return buildColoredGeometry(parts);
}

export function cabooseGeometry() {
  const parts = chassis(7);
  parts.push(
    { geometry: rbox(2.8, 2.3, 5.7, 0.14), color: '#ba4b3a', position: [0, 2, 0] },
    { geometry: rbox(3, 0.2, 6, 0.08), color: DARK, position: [0, 3.2, 0] },
    { geometry: rbox(2, 0.9, 1.8, 0.1), color: '#ba4b3a', position: [0, 3.65, 0] },
    { geometry: box(2.2, 0.15, 2), color: DARK, position: [0, 4.15, 0] },
  );
  for (const x of [-1.42, 1.42]) {
    for (const z of [-1.8, 1.8]) parts.push({ geometry: box(0.06, 0.8, 0.8), color: '#b7e0e9', position: [x, 2.4, z] });
  }
  return buildColoredGeometry(parts);
}

export function trackGeometry(length: number) {
  const parts: ColoredPart[] = [
    { geometry: box(3.8, 0.18, length + 0.08), color: '#a7a093', position: [0, 0.12, 0] },
  ];
  for (const x of [-0.82, 0.82]) parts.push({ geometry: box(0.1, 0.17, length + 0.08), color: STEEL, position: [x, 0.36, 0] });
  for (let i = 0; i < 5; i++) {
    parts.push({ geometry: box(2.7, 0.13, 0.22), color: '#75583c', position: [0, 0.24, -length / 2 + (i + 0.5) * length / 5] });
  }
  return buildColoredGeometry(parts);
}
