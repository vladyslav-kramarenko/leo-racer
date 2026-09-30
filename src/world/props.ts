import type * as THREE from 'three';
import { box, buildColoredGeometry, cone, cyl } from './geometry';
import type { PropKind } from './presets/types';

/**
 * Low-poly, toy-like prop library. All models are original, built from primitives.
 * Every model sits on y = 0 and faces -Z (toward the road when faceRoad is used).
 */

const YELLOW = '#ffc21a';
const DARK = '#2f3237';
const ORANGE = '#ff7a1a';
const WHITE = '#fafafa';
const GREY = '#a7a9ad';
const GLASS = '#9fd7ff';

function cone3d(): THREE.BufferGeometry {
  return buildColoredGeometry([
    { geometry: box(0.55, 0.06, 0.55), color: ORANGE, position: [0, 0.03, 0] },
    { geometry: cone(0.22, 0.75, 8), color: ORANGE, position: [0, 0.43, 0] },
    { geometry: cyl(0.12, 0.155, 0.12, 8), color: WHITE, position: [0, 0.5, 0] },
  ]);
}

function barrier(): THREE.BufferGeometry {
  const parts: Parameters<typeof buildColoredGeometry>[0] = [
    { geometry: box(0.12, 0.9, 0.12), color: GREY, position: [-0.85, 0.45, 0] },
    { geometry: box(0.12, 0.9, 0.12), color: GREY, position: [0.85, 0.45, 0] },
    { geometry: box(0.5, 0.06, 0.4), color: DARK, position: [-0.85, 0.03, 0] },
    { geometry: box(0.5, 0.06, 0.4), color: DARK, position: [0.85, 0.03, 0] },
  ];
  // Striped board.
  for (let i = 0; i < 6; i++) {
    parts.push({
      geometry: box(0.33, 0.3, 0.08),
      color: i % 2 ? WHITE : '#ff4d3d',
      position: [-0.83 + i * 0.332, 0.72, 0],
    });
  }
  return buildColoredGeometry(parts);
}

function concreteBlock(): THREE.BufferGeometry {
  return buildColoredGeometry([
    { geometry: box(2, 0.8, 1), color: '#c9c6bf', position: [0, 0.4, 0] },
    { geometry: box(1.6, 0.35, 0.8), color: '#bcb8b0', position: [0.1, 0.97, 0.05], rotation: [0, 0.2, 0] },
  ]);
}

function pipes(): THREE.BufferGeometry {
  const parts: Parameters<typeof buildColoredGeometry>[0] = [];
  const r = 0.45;
  const rows = [
    [-1, 0, 1],
    [-0.5, 0.5],
    [0],
  ];
  rows.forEach((row, level) => {
    row.forEach((x) => {
      parts.push({
        geometry: cyl(r, r, 3.2, 10),
        color: level % 2 ? '#4d9de0' : '#3a86c8',
        position: [x * r * 2, r + level * r * 1.7, 0],
        rotation: [Math.PI / 2, 0, 0],
      });
    });
  });
  return buildColoredGeometry(parts);
}

function sign(): THREE.BufferGeometry {
  return buildColoredGeometry([
    { geometry: box(0.1, 1.4, 0.1), color: GREY, position: [0, 0.7, 0] },
    { geometry: cyl(0.75, 0.75, 0.06, 3), color: DARK, position: [0, 1.75, 0.02], rotation: [Math.PI / 2, 0, 0] },
    { geometry: cyl(0.62, 0.62, 0.07, 3), color: YELLOW, position: [0, 1.75, -0.01], rotation: [Math.PI / 2, 0, 0] },
    { geometry: box(0.12, 0.4, 0.02), color: DARK, position: [0, 1.8, -0.06] },
    { geometry: box(0.12, 0.1, 0.02), color: DARK, position: [0, 1.52, -0.06] },
  ]);
}

function gravel(): THREE.BufferGeometry {
  return buildColoredGeometry([
    { geometry: cone(2.4, 1.6, 9), color: '#a8998a', position: [0, 0.8, 0] },
    { geometry: cone(1.5, 1.1, 8), color: '#b5a797', position: [1.4, 0.55, 0.8] },
  ]);
}

function wheel(x: number, z: number, r = 0.55): Parameters<typeof buildColoredGeometry>[0][number] {
  return { geometry: cyl(r, r, 0.45, 12), color: DARK, position: [x, r, z], rotation: [0, 0, Math.PI / 2] };
}

function excavator(): THREE.BufferGeometry {
  return buildColoredGeometry([
    // Tracks
    { geometry: box(0.8, 0.8, 3.4), color: DARK, position: [-1.1, 0.4, 0] },
    { geometry: box(0.8, 0.8, 3.4), color: DARK, position: [1.1, 0.4, 0] },
    // Body + cab
    { geometry: box(2.6, 1.1, 2.6), color: YELLOW, position: [0, 1.35, 0.2] },
    { geometry: box(1.2, 1.3, 1.2), color: YELLOW, position: [-0.6, 2.5, -0.4] },
    { geometry: box(1.0, 0.8, 0.05), color: GLASS, position: [-0.6, 2.6, -1.02] },
    // Boom, arm, bucket
    { geometry: box(0.45, 0.45, 3), color: YELLOW, position: [0.6, 2.8, -1.8], rotation: [-0.6, 0, 0] },
    { geometry: box(0.4, 0.4, 2.3), color: YELLOW, position: [0.6, 2.9, -3.8], rotation: [0.9, 0, 0] },
    { geometry: box(1.1, 0.8, 0.8), color: GREY, position: [0.6, 1.9, -4.6], rotation: [0.4, 0, 0] },
  ]);
}

function dumpTruck(): THREE.BufferGeometry {
  return buildColoredGeometry([
    { geometry: box(2.4, 0.5, 5.2), color: DARK, position: [0, 0.85, 0] },
    // Cab
    { geometry: box(2.4, 1.6, 1.6), color: ORANGE, position: [0, 1.9, -1.8] },
    { geometry: box(2.1, 0.7, 0.05), color: GLASS, position: [0, 2.2, -2.62] },
    // Dump bed, tipped slightly
    { geometry: box(2.6, 1.3, 3.2), color: YELLOW, position: [0, 2.0, 0.9], rotation: [-0.12, 0, 0] },
    { geometry: box(2.0, 0.5, 2.6), color: '#9a8466', position: [0, 2.55, 0.9], rotation: [-0.12, 0, 0] },
    wheel(-1.25, -1.8),
    wheel(1.25, -1.8),
    wheel(-1.25, 1.6),
    wheel(1.25, 1.6),
  ]);
}

function crane(): THREE.BufferGeometry {
  const parts: Parameters<typeof buildColoredGeometry>[0] = [
    { geometry: box(3, 0.8, 3), color: '#c9c6bf', position: [0, 0.4, 0] },
    { geometry: box(1.4, 1.4, 1.6), color: YELLOW, position: [0, 13.2, 0.8] },
    // Jib and counter-jib
    { geometry: box(0.6, 0.6, 14), color: YELLOW, position: [0, 14.2, -5] },
    { geometry: box(0.6, 0.6, 5), color: YELLOW, position: [0, 14.2, 4.5] },
    { geometry: box(1.4, 1.2, 1.6), color: '#8c8f94', position: [0, 13.6, 6.2] },
    { geometry: box(0.05, 7, 0.05), color: DARK, position: [0, 10.6, -10] },
    { geometry: box(0.6, 0.6, 0.6), color: '#ff4d3d', position: [0, 6.9, -10] },
  ];
  // Mast built from stacked segments, alternating tones for a lattice feel.
  for (let i = 0; i < 6; i++) {
    parts.push({ geometry: box(1, 2, 1), color: i % 2 ? YELLOW : '#f0b000', position: [0, 1.8 + i * 2, 0] });
  }
  return buildColoredGeometry(parts);
}

const BUILDERS: Record<PropKind, () => THREE.BufferGeometry> = {
  cone: cone3d,
  barrier,
  concreteBlock,
  pipes,
  sign,
  gravel,
  excavator,
  dumpTruck,
  crane,
};

export function buildPropGeometry(kind: PropKind): THREE.BufferGeometry {
  return BUILDERS[kind]();
}
