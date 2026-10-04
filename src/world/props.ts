import * as THREE from 'three';
import { box, buildColoredGeometry, cone, cyl, ico, prism, type ColoredPart } from './geometry';
import type { PropKind } from './presets/types';

/**
 * Low-poly, toy-like prop library. All models are original, built from primitives.
 * Every model sits on y = 0 and faces -Z.
 *
 * A model is a static body plus optional animated parts (crane jib, windmill blades,
 * blinking beacon…). Animation is a predefined, data-only description — no per-prop code.
 */

export type PartAnim =
  /** Continuous rotation (rad/s). */
  | { type: 'spin'; axis: 'x' | 'y' | 'z'; speed: number }
  /** angle = bias + amplitude·sin(speed·t). */
  | { type: 'swing'; axis: 'x' | 'y' | 'z'; amplitude: number; speed: number; bias?: number }
  /** Visible for `duty` of each cycle. Keep hz well below 3 (photosensitivity). */
  | { type: 'blink'; hz: number; duty: number }
  /** Visible during [from, to) of a `period`-second cycle (traffic lights). */
  | { type: 'cycle'; period: number; from: number; to: number };

export interface PartModel {
  /** Geometry in part-local space (pivot at the origin). */
  geometry: THREE.BufferGeometry;
  pivot: [number, number, number];
  anim: PartAnim;
  /** Unlit (lamps). */
  unlit?: boolean;
}

export interface PropModel {
  body: THREE.BufferGeometry;
  parts?: PartModel[];
  /** Per-instance colour tints (multiplied with the vertex colours). */
  tints?: string[];
}

const YELLOW = '#ffc21a';
const DARK = '#2f3237';
const ORANGE = '#ff7a1a';
const WHITE = '#fafafa';
const GREY = '#a7a9ad';
const GLASS = '#9fd7ff';
const BROWN = '#7a4e2d';
const PINE_GREEN = '#2f6b3f';
const LEAF_GREEN = '#5aa646';

/** Build a part from parts given in model coordinates, re-centred on its pivot. */
function part(parts: ColoredPart[], pivot: [number, number, number], anim: PartAnim, unlit = false): PartModel {
  const geometry = buildColoredGeometry(parts);
  geometry.translate(-pivot[0], -pivot[1], -pivot[2]);
  return { geometry, pivot, anim, unlit };
}

const model = (parts: ColoredPart[], extra: Omit<PropModel, 'body'> = {}): PropModel => ({
  body: buildColoredGeometry(parts),
  ...extra,
});

function wheel(x: number, z: number, r = 0.55, w = 0.45): ColoredPart {
  return { geometry: cyl(r, r, w, 12), color: DARK, position: [x, r, z], rotation: [0, 0, Math.PI / 2] };
}

// ---------------------------------------------------------------- Construction

function coneModel(): PropModel {
  return model([
    { geometry: box(0.55, 0.06, 0.55), color: ORANGE, position: [0, 0.03, 0] },
    { geometry: cone(0.22, 0.75, 8), color: ORANGE, position: [0, 0.43, 0] },
    { geometry: cyl(0.12, 0.155, 0.12, 8), color: WHITE, position: [0, 0.5, 0] },
  ]);
}

function barrier(): PropModel {
  const parts: ColoredPart[] = [
    { geometry: box(0.12, 0.9, 0.12), color: GREY, position: [-0.85, 0.45, 0] },
    { geometry: box(0.12, 0.9, 0.12), color: GREY, position: [0.85, 0.45, 0] },
    { geometry: box(0.5, 0.06, 0.4), color: DARK, position: [-0.85, 0.03, 0] },
    { geometry: box(0.5, 0.06, 0.4), color: DARK, position: [0.85, 0.03, 0] },
    { geometry: cyl(0.1, 0.1, 0.05, 8), color: DARK, position: [-0.85, 0.92, 0] },
  ];
  for (let i = 0; i < 6; i++) {
    parts.push({ geometry: box(0.33, 0.3, 0.08), color: i % 2 ? WHITE : '#ff4d3d', position: [-0.83 + i * 0.332, 0.72, 0] });
  }
  // Gentle amber beacon, 1 Hz.
  const beacon = part(
    [{ geometry: cyl(0.09, 0.1, 0.16, 8), color: '#ffb000', position: [-0.85, 1.03, 0] }],
    [-0.85, 1.03, 0],
    { type: 'blink', hz: 1, duty: 0.5 },
    true,
  );
  return model(parts, { parts: [beacon] });
}

function concreteBlock(): PropModel {
  return model([
    { geometry: box(2, 0.8, 1), color: '#c9c6bf', position: [0, 0.4, 0] },
    { geometry: box(1.6, 0.35, 0.8), color: '#bcb8b0', position: [0.1, 0.97, 0.05], rotation: [0, 0.2, 0] },
  ]);
}

function pipes(): PropModel {
  const parts: ColoredPart[] = [];
  const r = 0.45;
  [[-1, 0, 1], [-0.5, 0.5], [0]].forEach((row, level) => {
    row.forEach((x) => {
      parts.push({
        geometry: cyl(r, r, 3.2, 10),
        color: level % 2 ? '#4d9de0' : '#3a86c8',
        position: [x * r * 2, r + level * r * 1.7, 0],
        rotation: [Math.PI / 2, 0, 0],
      });
    });
  });
  return model(parts);
}

function sign(): PropModel {
  return model([
    { geometry: box(0.1, 1.4, 0.1), color: GREY, position: [0, 0.7, 0] },
    { geometry: cyl(0.75, 0.75, 0.06, 3), color: DARK, position: [0, 1.75, 0.02], rotation: [Math.PI / 2, 0, 0] },
    { geometry: cyl(0.62, 0.62, 0.07, 3), color: YELLOW, position: [0, 1.75, -0.01], rotation: [Math.PI / 2, 0, 0] },
    { geometry: box(0.12, 0.4, 0.02), color: DARK, position: [0, 1.8, -0.06] },
    { geometry: box(0.12, 0.1, 0.02), color: DARK, position: [0, 1.52, -0.06] },
  ]);
}

function gravel(): PropModel {
  return model([
    { geometry: cone(2.4, 1.6, 9), color: '#a8998a', position: [0, 0.8, 0] },
    { geometry: cone(1.5, 1.1, 8), color: '#b5a797', position: [1.4, 0.55, 0.8] },
  ]);
}

function excavator(): PropModel {
  const pivot: [number, number, number] = [0.6, 2.2, -0.6];
  return model(
    [
      { geometry: box(0.8, 0.8, 3.4), color: DARK, position: [-1.1, 0.4, 0] },
      { geometry: box(0.8, 0.8, 3.4), color: DARK, position: [1.1, 0.4, 0] },
      { geometry: box(2.6, 1.1, 2.6), color: YELLOW, position: [0, 1.35, 0.2] },
      { geometry: box(1.2, 1.3, 1.2), color: YELLOW, position: [-0.6, 2.5, -0.4] },
      { geometry: box(1.0, 0.8, 0.05), color: GLASS, position: [-0.6, 2.6, -1.02] },
    ],
    {
      parts: [
        part(
          [
            { geometry: box(0.45, 0.45, 3), color: YELLOW, position: [0.6, 2.8, -1.8], rotation: [-0.6, 0, 0] },
            { geometry: box(0.4, 0.4, 2.3), color: YELLOW, position: [0.6, 2.9, -3.8], rotation: [0.9, 0, 0] },
            { geometry: box(1.1, 0.8, 0.8), color: GREY, position: [0.6, 1.9, -4.6], rotation: [0.4, 0, 0] },
          ],
          pivot,
          { type: 'swing', axis: 'x', amplitude: 0.16, speed: 0.7 },
        ),
      ],
    },
  );
}

function dumpTruckParts(): { body: ColoredPart[]; bed: ColoredPart[]; pivot: [number, number, number] } {
  return {
    body: [
      { geometry: box(2.4, 0.5, 5.2), color: DARK, position: [0, 0.85, 0] },
      { geometry: box(2.4, 1.6, 1.6), color: ORANGE, position: [0, 1.9, -1.8] },
      { geometry: box(2.1, 0.7, 0.05), color: GLASS, position: [0, 2.2, -2.62] },
      wheel(-1.25, -1.8),
      wheel(1.25, -1.8),
      wheel(-1.25, 1.6),
      wheel(1.25, 1.6),
    ],
    bed: [
      { geometry: box(2.6, 1.3, 3.2), color: YELLOW, position: [0, 1.75, 0.9] },
      { geometry: box(2.0, 0.5, 2.6), color: '#9a8466', position: [0, 2.3, 0.9] },
    ],
    pivot: [0, 1.1, 2.5],
  };
}

function dumpTruck(): PropModel {
  const { body, bed, pivot } = dumpTruckParts();
  // Parked on site, slowly tipping its bed.
  return model(body, { parts: [part(bed, pivot, { type: 'swing', axis: 'x', amplitude: 0.2, speed: 0.35, bias: 0.2 })] });
}

function crane(): PropModel {
  const parts: ColoredPart[] = [{ geometry: box(3, 0.8, 3), color: '#c9c6bf', position: [0, 0.4, 0] }];
  for (let i = 0; i < 6; i++) {
    parts.push({ geometry: box(1, 2, 1), color: i % 2 ? YELLOW : '#f0b000', position: [0, 1.8 + i * 2, 0] });
  }
  const slewing = part(
    [
      { geometry: box(1.4, 1.4, 1.6), color: YELLOW, position: [0, 13.2, 0.8] },
      { geometry: box(0.6, 0.6, 14), color: YELLOW, position: [0, 14.2, -5] },
      { geometry: box(0.6, 0.6, 5), color: YELLOW, position: [0, 14.2, 4.5] },
      { geometry: box(1.4, 1.2, 1.6), color: '#8c8f94', position: [0, 13.6, 6.2] },
      { geometry: box(0.05, 7, 0.05), color: DARK, position: [0, 10.6, -10] },
      { geometry: box(0.6, 0.6, 0.6), color: '#ff4d3d', position: [0, 6.9, -10] },
    ],
    [0, 12.6, 0],
    { type: 'spin', axis: 'y', speed: 0.1 },
  );
  return model(parts, { parts: [slewing] });
}

// ---------------------------------------------------------------- Nature

function pine(): PropModel {
  return model([{ geometry: cyl(0.22, 0.3, 1.6, 6), color: BROWN, position: [0, 0.8, 0] }], {
    parts: [
      part(
        [
          { geometry: cone(2.1, 3, 7), color: PINE_GREEN, position: [0, 2.7, 0] },
          { geometry: cone(1.6, 2.6, 7), color: '#3a7a48', position: [0, 4.1, 0] },
          { geometry: cone(1.05, 2.1, 7), color: '#448856', position: [0, 5.4, 0] },
        ],
        [0, 1.4, 0],
        { type: 'swing', axis: 'z', amplitude: 0.02, speed: 1.1 },
      ),
    ],
  });
}

function roundTree(): PropModel {
  return model([{ geometry: cyl(0.2, 0.28, 2.2, 6), color: BROWN, position: [0, 1.1, 0] }], {
    parts: [
      part(
        [
          { geometry: ico(1.8, 0), color: LEAF_GREEN, position: [0, 3.3, 0] },
          { geometry: ico(1.2, 0), color: '#66b351', position: [0.9, 3.9, 0.3] },
          { geometry: ico(1.1, 0), color: '#4e9a3e', position: [-0.8, 3.7, -0.4] },
        ],
        [0, 2, 0],
        { type: 'swing', axis: 'z', amplitude: 0.025, speed: 1.3 },
      ),
    ],
  });
}

function rock(): PropModel {
  return model([
    { geometry: ico(1, 0), color: '#9a9a96', position: [0, 0.45, 0], scale: [1.3, 0.75, 1] },
    { geometry: ico(0.55, 0), color: '#8a8b88', position: [0.9, 0.25, 0.4], scale: [1, 0.8, 1.1] },
  ]);
}

function bush(): PropModel {
  return model([
    { geometry: ico(0.9, 0), color: '#4f9a3c', position: [0, 0.6, 0] },
    { geometry: ico(0.6, 0), color: '#5daa48', position: [0.7, 0.45, 0.2] },
  ]);
}

function flowers(): PropModel {
  const parts: ColoredPart[] = [{ geometry: ico(0.75, 0), color: '#5aa646', position: [0, 0.2, 0], scale: [1.3, 0.35, 1.1] }];
  const colors = ['#ff5b6e', '#ffd23f', '#ff8fd0', '#ffffff', '#b07cff'];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = 0.25 + (i % 3) * 0.2;
    parts.push({ geometry: ico(0.13, 0), color: colors[i % colors.length], position: [Math.cos(a) * r, 0.45, Math.sin(a) * r] });
  }
  return model(parts);
}

function log(): PropModel {
  return model([
    { geometry: cyl(0.35, 0.35, 3, 8), color: '#8a5a3a', position: [0, 0.35, 0], rotation: [0, 0, Math.PI / 2] },
    { geometry: cyl(0.3, 0.3, 3.04, 8), color: '#d9b27c', position: [0, 0.35, 0], rotation: [0, 0, Math.PI / 2] },
  ]);
}

function viewpoint(): PropModel {
  return model([
    { geometry: box(0.12, 1.3, 0.12), color: BROWN, position: [-0.7, 0.65, 0] },
    { geometry: box(0.12, 1.3, 0.12), color: BROWN, position: [0.7, 0.65, 0] },
    { geometry: box(1.8, 1, 0.1), color: '#6b4426', position: [0, 1.6, 0] },
    { geometry: cone(0.35, 0.5, 3), color: WHITE, position: [-0.25, 1.62, -0.07], scale: [1, 1, 0.1] },
    { geometry: cone(0.28, 0.4, 3), color: WHITE, position: [0.25, 1.57, -0.07], scale: [1, 1, 0.1] },
  ]);
}

function sailboat(): PropModel {
  return model(
    [
      { geometry: box(1.5, 0.6, 4), color: WHITE, position: [0, 0.3, 0] },
      { geometry: box(1.2, 0.1, 3.4), color: '#c79a63', position: [0, 0.62, 0] },
    ],
    {
      parts: [
        part(
          [
            { geometry: cyl(0.06, 0.06, 4.5, 5), color: GREY, position: [0, 2.9, 0.2] },
            { geometry: cone(1.1, 3.6, 3), color: '#fff7e6', position: [0, 2.6, 0.95], scale: [0.05, 1, 1] },
            { geometry: cone(0.7, 2.6, 3), color: '#ff6b5a', position: [0, 2.1, -0.6], scale: [0.05, 1, 1] },
          ],
          [0, 0.6, 0],
          { type: 'swing', axis: 'z', amplitude: 0.06, speed: 1.2 },
        ),
      ],
    },
  );
}

// ---------------------------------------------------------------- Farm

function fence(): PropModel {
  const parts: ColoredPart[] = [];
  for (const x of [-1.8, -0.6, 0.6, 1.8]) {
    parts.push({ geometry: box(0.14, 1.1, 0.14), color: '#f2efe6', position: [x, 0.55, 0] });
  }
  parts.push({ geometry: box(3.9, 0.14, 0.08), color: '#f2efe6', position: [0, 0.85, 0] });
  parts.push({ geometry: box(3.9, 0.14, 0.08), color: '#f2efe6', position: [0, 0.45, 0] });
  return model(parts);
}

function barn(): PropModel {
  return model([
    { geometry: box(6.4, 4.5, 8), color: '#c8402f', position: [0, 2.25, 0] },
    { geometry: prism(7, 2.8, 8.6), color: '#8f2a22', position: [0, 4.5, 0] },
    { geometry: box(2.6, 3, 0.1), color: WHITE, position: [0, 1.5, -4.02] },
    { geometry: box(2.3, 2.7, 0.12), color: '#a8352a', position: [0, 1.5, -4.05] },
    { geometry: box(0.15, 3.4, 0.14), color: WHITE, position: [0, 1.5, -4.1], rotation: [0, 0, 0.71] },
    { geometry: box(0.15, 3.4, 0.14), color: WHITE, position: [0, 1.5, -4.1], rotation: [0, 0, -0.71] },
    { geometry: box(1.2, 1, 0.1), color: WHITE, position: [0, 5.3, -4.05] },
  ]);
}

function silo(): PropModel {
  return model([
    { geometry: cyl(1.6, 1.6, 9, 12), color: '#d9d6cf', position: [0, 4.5, 0] },
    { geometry: cyl(1.65, 1.65, 0.25, 12), color: '#9aa5ad', position: [0, 3, 0] },
    { geometry: cyl(1.65, 1.65, 0.25, 12), color: '#9aa5ad', position: [0, 6, 0] },
    { geometry: ico(1.6, 1), color: '#9aa5ad', position: [0, 9, 0], scale: [1, 0.6, 1] },
  ]);
}

function hayBale(): PropModel {
  return model([
    { geometry: cyl(0.8, 0.8, 1.2, 12), color: '#e3c063', position: [0, 0.8, 0], rotation: [0, 0, Math.PI / 2] },
    { geometry: cyl(0.7, 0.7, 1.24, 12), color: '#f0d27a', position: [0, 0.8, 0], rotation: [0, 0, Math.PI / 2] },
  ]);
}

function cow(): PropModel {
  const legs: ColoredPart[] = [];
  for (const [x, z] of [
    [-0.35, -0.6],
    [0.35, -0.6],
    [-0.35, 0.6],
    [0.35, 0.6],
  ]) {
    legs.push({ geometry: cyl(0.11, 0.11, 0.7, 6), color: '#3a3a3a', position: [x, 0.35, z] });
  }
  return model(
    [
      { geometry: box(1, 0.9, 1.8), color: '#f7f7f2', position: [0, 1.1, 0] },
      { geometry: box(1.02, 0.5, 0.6), color: '#2e2e2e', position: [0, 1.25, 0.3] },
      { geometry: box(0.5, 0.4, 0.5), color: '#2e2e2e', position: [0.26, 1.3, -0.4] },
      { geometry: box(0.08, 0.6, 0.08), color: '#f7f7f2', position: [0, 1.1, 0.95] },
      ...legs,
    ],
    {
      parts: [
        part(
          [
            { geometry: box(0.6, 0.6, 0.7), color: '#f7f7f2', position: [0, 1.25, -1.2] },
            { geometry: box(0.5, 0.3, 0.25), color: '#ffb3b8', position: [0, 1.1, -1.6] },
            { geometry: box(0.1, 0.25, 0.1), color: '#e8e0c8', position: [-0.22, 1.65, -1.1] },
            { geometry: box(0.1, 0.25, 0.1), color: '#e8e0c8', position: [0.22, 1.65, -1.1] },
          ],
          [0, 1.3, -0.9],
          { type: 'swing', axis: 'x', amplitude: 0.25, speed: 0.6, bias: -0.25 },
        ),
      ],
    },
  );
}

function sheep(): PropModel {
  const legs: ColoredPart[] = [];
  for (const [x, z] of [
    [-0.25, -0.4],
    [0.25, -0.4],
    [-0.25, 0.4],
    [0.25, 0.4],
  ]) {
    legs.push({ geometry: cyl(0.07, 0.07, 0.5, 5), color: '#2e2e2e', position: [x, 0.25, z] });
  }
  return model([
    { geometry: ico(0.6, 1), color: '#fbfbf6', position: [0, 0.85, 0], scale: [1, 0.85, 1.35] },
    { geometry: box(0.35, 0.4, 0.45), color: '#2e2e2e', position: [0, 1.0, -0.85] },
    ...legs,
  ]);
}

function windmill(): PropModel {
  const blades: ColoredPart[] = [{ geometry: cyl(0.3, 0.3, 0.3, 8), color: GREY, position: [0, 9, -1.0], rotation: [Math.PI / 2, 0, 0] }];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    blades.push({
      geometry: box(0.5, 4.2, 0.08),
      color: '#f6f1e4',
      position: [Math.sin(a) * 2.2, 9 + Math.cos(a) * 2.2, -1.05],
      rotation: [0, 0, -a],
    });
  }
  return model(
    [
      { geometry: cyl(0.7, 1.4, 9, 8), color: '#f3efe6', position: [0, 4.5, 0] },
      { geometry: box(1.6, 1.4, 2), color: '#c8402f', position: [0, 9, 0] },
      { geometry: box(0.9, 1.6, 0.1), color: '#7a4e2d', position: [0, 0.8, -1.25] },
    ],
    { parts: [part(blades, [0, 9, -1.0], { type: 'spin', axis: 'z', speed: 0.8 })] },
  );
}

function tractorParts(): ColoredPart[] {
  return [
    { geometry: box(1.4, 1, 2.6), color: '#3a9a3e', position: [0, 1.2, -0.4] },
    { geometry: box(1.5, 1.4, 1.3), color: '#3a9a3e', position: [0, 1.7, 0.8] },
    { geometry: box(1.3, 0.9, 0.05), color: GLASS, position: [0, 2.0, 0.13] },
    { geometry: box(1.6, 0.1, 1.5), color: '#2f7f33', position: [0, 2.45, 0.8] },
    { geometry: cyl(0.08, 0.08, 1, 6), color: DARK, position: [0.45, 2.1, -1.2] },
    wheel(-0.95, 0.9, 0.95, 0.5),
    wheel(0.95, 0.9, 0.95, 0.5),
    wheel(-0.8, -1.3, 0.5, 0.35),
    wheel(0.8, -1.3, 0.5, 0.35),
  ];
}

// ---------------------------------------------------------------- City

const HOUSE_TINTS = ['#ffe0b8', '#cfe8ff', '#ffd0d8', '#e0f5d0', '#fff4b8', '#e9dcff'];

function house(): PropModel {
  return model(
    [
      { geometry: box(5, 3.2, 5), color: WHITE, position: [0, 1.6, 0] },
      { geometry: prism(5.6, 2.2, 5.6), color: '#c4614f', position: [0, 3.2, 0] },
      { geometry: box(1, 2, 0.1), color: '#8a5a3a', position: [0, 1, -2.52] },
      { geometry: box(1.1, 1, 0.08), color: GLASS, position: [-1.5, 1.9, -2.52] },
      { geometry: box(1.1, 1, 0.08), color: GLASS, position: [1.5, 1.9, -2.52] },
      { geometry: box(0.5, 1.2, 0.5), color: '#8a8a8a', position: [1.4, 4.6, 0.8] },
    ],
    { tints: HOUSE_TINTS },
  );
}

function building(): PropModel {
  const parts: ColoredPart[] = [
    { geometry: box(8, 10, 7), color: WHITE, position: [0, 5, 0] },
    { geometry: box(8.3, 0.4, 7.3), color: '#9a9ca0', position: [0, 10.2, 0] },
    { geometry: box(1.6, 2.4, 0.1), color: '#5a6a7a', position: [0, 1.2, -3.52] },
  ];
  for (let floor = 1; floor < 4; floor++) {
    for (const x of [-2.6, 0, 2.6]) {
      parts.push({ geometry: box(1.5, 1.4, 0.08), color: GLASS, position: [x, 1.2 + floor * 2.6, -3.52] });
    }
  }
  return model(parts, { tints: ['#f2d7c0', '#d8e4f0', '#f0e6c8', '#e2d8ec', '#d4ecd8'] });
}

function shop(): PropModel {
  const parts: ColoredPart[] = [
    { geometry: box(6, 3.6, 5), color: WHITE, position: [0, 1.8, 0] },
    { geometry: box(4.2, 1.8, 0.08), color: GLASS, position: [-0.6, 1.4, -2.52] },
    { geometry: box(0.9, 2.2, 0.1), color: '#5a6a7a', position: [2.2, 1.1, -2.52] },
    { geometry: box(6.2, 0.3, 5.2), color: '#9a9ca0', position: [0, 3.75, 0] },
  ];
  for (let i = 0; i < 6; i++) {
    parts.push({ geometry: box(1, 0.12, 1.2), color: i % 2 ? WHITE : '#e8453c', position: [-2.5 + i, 2.85, -3.0], rotation: [0.35, 0, 0] });
  }
  return model(parts, { tints: ['#ffe9c8', '#d6f0ff', '#ffe0ec', '#e6f7d6'] });
}

function trafficLight(): PropModel {
  const lamp = (y: number, color: string, from: number, to: number) =>
    part([{ geometry: cyl(0.13, 0.13, 0.08, 10), color, position: [0, y, -0.2], rotation: [Math.PI / 2, 0, 0] }], [0, y, -0.2], {
      type: 'cycle',
      period: 9,
      from,
      to,
    }, true);
  return model(
    [
      { geometry: cyl(0.08, 0.1, 3.4, 6), color: '#5b5e63', position: [0, 1.7, 0] },
      { geometry: box(0.45, 1.25, 0.32), color: '#2b2d31', position: [0, 3.95, 0] },
      { geometry: cyl(0.13, 0.13, 0.05, 10), color: '#4a1c1c', position: [0, 4.35, -0.17], rotation: [Math.PI / 2, 0, 0] },
      { geometry: cyl(0.13, 0.13, 0.05, 10), color: '#4a3d14', position: [0, 3.95, -0.17], rotation: [Math.PI / 2, 0, 0] },
      { geometry: cyl(0.13, 0.13, 0.05, 10), color: '#173d1f', position: [0, 3.55, -0.17], rotation: [Math.PI / 2, 0, 0] },
    ],
    {
      parts: [lamp(3.55, '#3ee06a', 0, 0.5), lamp(3.95, '#ffcc33', 0.5, 0.6), lamp(4.35, '#ff4040', 0.6, 1)],
    },
  );
}

function streetLamp(): PropModel {
  return model([
    { geometry: cyl(0.08, 0.11, 4.6, 6), color: '#5b5e63', position: [0, 2.3, 0] },
    { geometry: box(0.08, 0.08, 1.3), color: '#5b5e63', position: [0, 4.55, -0.6] },
    { geometry: box(0.35, 0.16, 0.6), color: '#3c3f44', position: [0, 4.45, -1.2] },
    { geometry: box(0.28, 0.04, 0.5), color: '#fff3c4', position: [0, 4.36, -1.2] },
  ]);
}

/** Generic small car, white so it can be tinted (parked) or coloured (traffic). */
export function carParts(color: string = WHITE): ColoredPart[] {
  return [
    { geometry: box(1.8, 0.7, 4), color, position: [0, 0.7, 0] },
    { geometry: box(1.6, 0.65, 2.1), color, position: [0, 1.35, 0.2] },
    { geometry: box(1.5, 0.5, 0.05), color: GLASS, position: [0, 1.38, -0.86] },
    { geometry: box(1.5, 0.45, 0.05), color: GLASS, position: [0, 1.38, 1.26] },
    { geometry: box(0.05, 0.45, 1.8), color: GLASS, position: [-0.81, 1.38, 0.2] },
    { geometry: box(0.05, 0.45, 1.8), color: GLASS, position: [0.81, 1.38, 0.2] },
    { geometry: box(0.3, 0.15, 0.05), color: '#fff6d0', position: [-0.6, 0.8, -2.02] },
    { geometry: box(0.3, 0.15, 0.05), color: '#fff6d0', position: [0.6, 0.8, -2.02] },
    { geometry: box(0.3, 0.15, 0.05), color: '#e33', position: [-0.6, 0.8, 2.02] },
    { geometry: box(0.3, 0.15, 0.05), color: '#e33', position: [0.6, 0.8, 2.02] },
    wheel(-0.85, -1.25, 0.38, 0.3),
    wheel(0.85, -1.25, 0.38, 0.3),
    wheel(-0.85, 1.25, 0.38, 0.3),
    wheel(0.85, 1.25, 0.38, 0.3),
  ];
}

const CAR_TINTS = ['#e8453c', '#3d7be0', '#f2c230', '#46b05a', '#f2f2f2', '#9b59d0', '#ff8a3d'];

const BUILDERS: Record<PropKind, () => PropModel> = {
  cone: coneModel,
  barrier,
  concreteBlock,
  pipes,
  sign,
  gravel,
  excavator,
  dumpTruck,
  crane,
  pine,
  roundTree,
  rock,
  bush,
  flowers,
  log,
  viewpoint,
  sailboat,
  fence,
  barn,
  silo,
  hayBale,
  cow,
  sheep,
  windmill,
  tractor: () => model(tractorParts()),
  house,
  building,
  shop,
  trafficLight,
  streetLamp,
  parkedCar: () => model(carParts(), { tints: CAR_TINTS }),
};

export function buildPropModel(kind: PropKind): PropModel {
  return BUILDERS[kind]();
}

export const PROP_KINDS = Object.keys(BUILDERS) as PropKind[];

export { dumpTruckParts, tractorParts };
