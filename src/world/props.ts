import * as THREE from 'three';
import { box, buildColoredGeometry, cone, cyl, dome, extrudeProfile, ico, prism, rbox, type ColoredPart } from './geometry';
import type { PropKind } from './presets/types';
import { carParts, dumpTruckParts, tractorParts, TOY } from './toyParts';
import { quarry } from './quarry';
import { pipeTrench } from './pipeTrench';
import { wildlife, wildlifeBridge } from './wildlife';
import { autumnTree, cornRows, harvestStand, leafPile, pumpkinPatch, pumpkinPile, scarecrow } from './autumnProps';
import { harvestRide } from './harvestRide';
import { chalet, fox, hare, iceRink, skiSlope, sledHill, snowbank, snowFort, snowman, snowPine } from './winterProps';

/**
 * Low-poly, toy-like prop library. All models are original, built from primitives:
 * rounded boxes, smooth-ish cylinders and lumpy icospheres — the same style as the bus.
 * Every model sits on y = 0 and faces -Z.
 *
 * A model is a static body plus optional animated parts (crane jib, windmill blades,
 * blinking beacon…). Animation is a predefined, data-only description — no per-prop code.
 */

export type PartAnim =
  /** Fixed geometry, for luminous windows and lamps. */
  | { type: 'steady' }
  /** Continuous rotation (rad/s). */
  | { type: 'spin'; axis: 'x' | 'y' | 'z'; speed: number }
  /** angle = bias + amplitude·sin(speed·t). */
  | { type: 'swing'; axis: 'x' | 'y' | 'z'; amplitude: number; speed: number; bias?: number }
  /** Visible for `duty` of each cycle. Keep hz well below 3 (photosensitivity). */
  | { type: 'blink'; hz: number; duty: number }
  /** Visible during [from, to) of a `period`-second cycle (traffic lights). */
  | { type: 'cycle'; period: number; from: number; to: number }
  /**
   * Conveyor: moves by `vector` over `period` seconds, then jumps back. Spacing N copies
   * exactly `vector` apart (and hiding the ends) makes a seamless endless line — gondola cabins.
   */
  | { type: 'slide'; vector: [number, number, number]; period: number }
  /** Glides smoothly from the pivot to pivot + `vector` and back over `period` seconds (lifts, hoists). */
  | { type: 'shuttle'; vector: [number, number, number]; period: number }
  /** Slowly drives forwards and backs along a circular arc, turning with the path. */
  | { type: 'maneuver'; radius: number; angle: number; period: number }
  /** An animal walking back and forth over a flat wildlife overpass, turning at the ends. */
  | { type: 'crossing'; span: number; period: number }
  /** Follows an ellipse, facing the direction of travel (ice skaters). */
  | { type: 'orbit'; radius: [number, number]; period: number }
  /** A convoy on an oval; distance behind the leader keeps wagons on the same track. */
  | { type: 'circuit'; radius: number; halfStraight: number; period: number; behind: number; towTo?: number };

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
  /** Rectangular excavation footprint in model-local X/Z; disappears when the instance recycles. */
  groundCutout?: { center: [number, number]; size: [number, number] };
  /** Worksites/bridges keep random props outside this rectangle around the model origin. */
  placementExclusion?: [number, number];
}

const { YELLOW, DARK, ORANGE, WHITE, GLASS } = TOY;
const GREY = '#a7a9ad';
const STEEL = '#7d8288';
const BROWN = '#7a4e2d';
const WOOD = '#a8743f';
const PINE_GREEN = '#2f6b3f';
const LEAF_GREEN = '#5aa646';
const SIDEWAYS: [number, number, number] = [0, 0, Math.PI / 2];
const FACING_Z: [number, number, number] = [Math.PI / 2, 0, 0];

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

// ---------------------------------------------------------------- Construction

function coneModel(): PropModel {
  return model([
    { geometry: rbox(0.58, 0.07, 0.58, 0.04), color: ORANGE, position: [0, 0.035, 0] },
    { geometry: cyl(0.05, 0.25, 0.78, 12), color: ORANGE, position: [0, 0.46, 0] },
    // Two reflective bands.
    { geometry: cyl(0.135, 0.165, 0.1, 12), color: WHITE, position: [0, 0.5, 0] },
    { geometry: cyl(0.085, 0.11, 0.08, 12), color: WHITE, position: [0, 0.68, 0] },
  ]);
}

function barrier(): PropModel {
  const parts: ColoredPart[] = [];
  for (const x of [-0.85, 0.85]) {
    parts.push(
      { geometry: rbox(0.12, 0.95, 0.12, 0.04), color: GREY, position: [x, 0.48, 0] },
      { geometry: rbox(0.5, 0.08, 0.42, 0.04), color: DARK, position: [x, 0.04, 0] },
    );
  }
  for (let i = 0; i < 6; i++) {
    parts.push({ geometry: rbox(0.33, 0.3, 0.08, 0.02), color: i % 2 ? WHITE : '#ff4d3d', position: [-0.83 + i * 0.332, 0.72, 0] });
  }
  parts.push({ geometry: cyl(0.1, 0.12, 0.06, 10), color: DARK, position: [-0.85, 0.98, 0] });
  // Gentle amber beacon dome, 1 Hz.
  const beacon = part([{ geometry: dome(0.1, 10), color: '#ffb000', position: [-0.85, 1.01, 0] }], [-0.85, 1.01, 0], {
    type: 'blink',
    hz: 1,
    duty: 0.5,
  }, true);
  return model(parts, { parts: [beacon] });
}

function concreteBlock(): PropModel {
  // Jersey barriers: wide foot, slanted face, flat top.
  const jersey: [number, number][] = [
    [-0.42, 0],
    [0.42, 0],
    [0.4, 0.2],
    [0.18, 0.4],
    [0.13, 0.82],
    [-0.13, 0.82],
    [-0.18, 0.4],
    [-0.4, 0.2],
  ];
  return model([
    { geometry: extrudeProfile(jersey, 2, 0.03), color: '#cfccc5', position: [0, 0, 0], rotation: [0, Math.PI / 2, 0] },
    { geometry: rbox(1.9, 0.08, 0.06, 0.02), color: '#ff4d3d', position: [0, 0.7, -0.15] },
    { geometry: extrudeProfile(jersey, 1.6, 0.03), color: '#bdb9b0', position: [0.4, 0, 1.2], rotation: [0, Math.PI / 2 + 0.25, 0] },
  ]);
}

function pipes(): PropModel {
  const parts: ColoredPart[] = [];
  const r = 0.45;
  [[-1, 0, 1], [-0.5, 0.5], [0]].forEach((row, level) => {
    row.forEach((x) => {
      const pos: [number, number, number] = [x * r * 2, r + level * r * 1.7, 0];
      parts.push(
        { geometry: cyl(r, r, 3.2, 14), color: level % 2 ? '#4d9de0' : '#3a86c8', position: pos, rotation: FACING_Z },
        // Dark openings so the pipes read as hollow.
        { geometry: cyl(r * 0.72, r * 0.72, 3.22, 12), color: '#1f3b58', position: pos, rotation: FACING_Z },
      );
    });
  });
  // Wooden chocks.
  parts.push(
    { geometry: rbox(3.2, 0.16, 0.3, 0.05), color: WOOD, position: [0, 0.08, -1.2] },
    { geometry: rbox(3.2, 0.16, 0.3, 0.05), color: WOOD, position: [0, 0.08, 1.2] },
  );
  return model(parts);
}

function sign(): PropModel {
  return model([
    { geometry: cyl(0.05, 0.05, 1.45, 8), color: GREY, position: [0, 0.73, 0] },
    { geometry: rbox(0.36, 0.08, 0.36, 0.03), color: DARK, position: [0, 0.04, 0] },
    { geometry: cyl(0.78, 0.78, 0.07, 3), color: DARK, position: [0, 1.75, 0.02], rotation: [Math.PI / 2, 0, 0] },
    { geometry: cyl(0.66, 0.66, 0.08, 3), color: YELLOW, position: [0, 1.75, -0.01], rotation: [Math.PI / 2, 0, 0] },
    { geometry: rbox(0.12, 0.38, 0.03, 0.04), color: DARK, position: [0, 1.82, -0.06] },
    { geometry: cyl(0.065, 0.065, 0.03, 8), color: DARK, position: [0, 1.53, -0.06], rotation: FACING_Z },
  ]);
}

function gravel(): PropModel {
  return model([
    { geometry: ico(1.8, 1), color: '#a8998a', position: [0, 0.35, 0], scale: [1.35, 0.6, 1.2] },
    { geometry: ico(1.1, 1), color: '#b5a797', position: [1.4, 0.2, 0.8], scale: [1.3, 0.55, 1.2] },
    { geometry: ico(0.6, 1), color: '#968878', position: [-1.6, 0.12, -0.6], scale: [1.2, 0.5, 1] },
  ]);
}

/** A straight beam between two points in the YZ plane at a given x (excavator arm parts). */
function beam(x: number, a: [number, number], b: [number, number], thick: number, color: string): ColoredPart {
  const [ay, az] = a;
  const [by, bz] = b;
  const len = Math.hypot(by - ay, bz - az);
  return {
    geometry: rbox(thick, thick, len, thick * 0.3),
    color,
    position: [x, (ay + by) / 2, (az + bz) / 2],
    rotation: [Math.atan2(by - ay, -(bz - az)), 0, 0],
  };
}

function excavator(): PropModel {
  const tracks: ColoredPart[] = [];
  for (const x of [-1.1, 1.1]) {
    tracks.push({ geometry: rbox(0.8, 0.8, 3.4, 0.3, 2), color: DARK, position: [x, 0.42, 0] });
    for (const z of [-1.1, 0, 1.1]) {
      tracks.push({ geometry: cyl(0.22, 0.22, 0.84, 10), color: STEEL, position: [x, 0.42, z], rotation: SIDEWAYS });
    }
  }

  // Arm as a proper chain in the YZ plane (y up, z forward = negative):
  // boom root on the house → boom tip → stick tip → bucket.
  const x = 0.6;
  const root: [number, number] = [1.9, -0.9];
  const boomTip: [number, number] = [root[0] + 3 * Math.sin(0.87), root[1] - 3 * Math.cos(0.87)];
  const stickTip: [number, number] = [boomTip[0] - 2.6 * Math.sin(1.36), boomTip[1] - 2.6 * Math.cos(1.36)];
  const cylBase: [number, number] = [1.55, -1.15];
  const cylTop: [number, number] = [(root[0] + boomTip[0]) / 2 - 0.25, (root[1] + boomTip[1]) / 2 - 0.1];
  const arm: ColoredPart[] = [
    beam(x, root, boomTip, 0.46, YELLOW),
    beam(x, boomTip, stickTip, 0.38, YELLOW),
    beam(x - 0.2, cylBase, cylTop, 0.14, GREY),
    { geometry: cyl(0.2, 0.2, 0.6, 10), color: STEEL, position: [x, boomTip[0], boomTip[1]], rotation: SIDEWAYS },
    { geometry: cyl(0.16, 0.16, 0.56, 10), color: STEEL, position: [x, stickTip[0], stickTip[1]], rotation: SIDEWAYS },
    // Bucket hanging from the stick tip, opening forward, with teeth.
    { geometry: rbox(1.05, 0.72, 0.8, 0.14), color: GREY, position: [x, stickTip[0] - 0.4, stickTip[1] - 0.25], rotation: [0.35, 0, 0] },
    { geometry: rbox(0.95, 0.1, 0.18, 0.03), color: STEEL, position: [x, stickTip[0] - 0.82, stickTip[1] - 0.55], rotation: [0.35, 0, 0] },
  ];

  return model(
    [
      ...tracks,
      { geometry: rbox(2.6, 1.1, 2.6, 0.2, 2), color: YELLOW, position: [0, 1.38, 0.2] },
      { geometry: rbox(2.4, 0.7, 0.7, 0.18, 2), color: '#e0a800', position: [0, 1.5, 1.45] },
      { geometry: rbox(1.25, 1.35, 1.25, 0.2, 2), color: YELLOW, position: [-0.6, 2.55, -0.4] },
      { geometry: rbox(1.0, 0.8, 0.05, 0.04), color: GLASS, position: [-0.6, 2.65, -1.03] },
      { geometry: rbox(0.05, 0.75, 0.9, 0.04), color: GLASS, position: [-1.23, 2.65, -0.4] },
      { geometry: cyl(0.06, 0.06, 0.6, 6), color: DARK, position: [0.75, 2.2, 0.9] },
      // Boom foot bracket on the house.
      { geometry: rbox(0.6, 0.4, 0.6, 0.08), color: '#e0a800', position: [x, root[0] - 0.05, root[1]] },
    ],
    { parts: [part(arm, [x, root[0], root[1]], { type: 'swing', axis: 'x', amplitude: 0.14, speed: 0.7 })] },
  );
}

function dumpTruck(): PropModel {
  const { body, bed, pivot } = dumpTruckParts();
  // Parked on site, slowly tipping its bed.
  return model(body, { parts: [part(bed, pivot, { type: 'swing', axis: 'x', amplitude: 0.2, speed: 0.35, bias: 0.2 })] });
}

/**
 * Unfinished building: concrete frame with slabs on columns, brick infill on the lower floors,
 * a bare top floor with rebar sticking up, scaffolding with a green safety net on the front,
 * and a yellow construction hoist gliding up and down its mast. Faces the road (-Z).
 */
function unfinishedBuilding(): PropModel {
  const CONCRETE = '#c9c6bf';
  const SLAB = '#b8b4ab';
  const BRICK = '#b5654a';
  const REBAR = '#8a4f35';
  const SCAFFOLD = '#7d8288';
  const FLOOR = 3;
  const xs = [-4.6, 0, 4.6];
  const zs = [-3.6, 0, 3.6];
  const parts: ColoredPart[] = [{ geometry: rbox(10.6, 0.35, 8.6, 0.08), color: SLAB, position: [0, 0.18, 0] }];

  // Three finished floors: columns + slab.
  for (let f = 0; f < 3; f++) {
    const y0 = 0.35 + f * FLOOR;
    for (const x of xs) for (const z of zs) parts.push({ geometry: box(0.4, FLOOR, 0.4), color: CONCRETE, position: [x, y0 + FLOOR / 2, z] });
    parts.push({ geometry: rbox(10.4, 0.28, 8.4, 0.06), color: SLAB, position: [0, y0 + FLOOR, 0] });
  }
  // Top floor: only some columns so far, with rebar sticking out of them and the slab edge.
  const topY = 0.35 + 3 * FLOOR;
  for (const [x, z, h] of [
    [-4.6, -3.6, 2.6],
    [0, -3.6, 1.6],
    [-4.6, 0, 2.6],
    [-4.6, 3.6, 2.6],
    [0, 3.6, 1.2],
  ] as const) {
    parts.push({ geometry: box(0.4, h, 0.4), color: CONCRETE, position: [x, topY + h / 2, z] });
    for (const dx of [-0.12, 0.12]) parts.push({ geometry: box(0.04, 0.9, 0.04), color: REBAR, position: [x + dx, topY + h + 0.45, z] });
  }
  for (let i = 0; i < 6; i++) parts.push({ geometry: box(0.04, 0.7, 0.04), color: REBAR, position: [1.5 + i * 0.5, topY + 0.35, 3.9] });

  // Brick infill: ground floor mostly closed, first floor half done.
  parts.push(
    { geometry: box(4.2, 2.6, 0.3), color: BRICK, position: [-2.3, 1.65, 3.6] },
    { geometry: box(4.2, 2.6, 0.3), color: BRICK, position: [2.3, 1.65, 3.6] },
    { geometry: box(0.3, 2.6, 3.2), color: BRICK, position: [-4.6, 1.65, -1.8] },
    { geometry: box(4.2, 1.4, 0.3), color: BRICK, position: [-2.3, 4.05, 3.6] },
    { geometry: box(4.2, 2.6, 0.3), color: BRICK, position: [-2.3, 1.65, -3.6] },
    { geometry: box(1.8, 0.9, 0.3), color: BRICK, position: [1.2, 3.8, -3.6] },
  );

  // Scaffolding on the front: posts, planks per floor, cross braces, green safety net.
  const sz = -4.4;
  for (const x of [-4.8, -2.4, 0, 2.4, 4.8]) parts.push({ geometry: box(0.08, 11, 0.08), color: SCAFFOLD, position: [x, 5.5, sz] });
  for (let f = 1; f <= 3; f++) {
    const y = 0.35 + f * FLOOR - 0.1;
    parts.push(
      { geometry: box(9.8, 0.08, 0.7), color: '#c49a5a', position: [0, y, sz + 0.05] },
      { geometry: box(9.8, 0.06, 0.06), color: SCAFFOLD, position: [0, y + 1.0, sz - 0.3] },
    );
  }
  for (let i = 0; i < 4; i++) {
    parts.push({ geometry: box(0.06, 3.6, 0.06), color: SCAFFOLD, position: [-3.6 + i * 2.4, 4.8, sz - 0.32], rotation: [0, 0, i % 2 ? 0.58 : -0.58] });
  }
  parts.push({ geometry: box(4.6, 5.6, 0.04), color: '#4f9a5c', position: [2.4, 6.8, sz - 0.42] });

  // Hoist mast on the right side.
  const mastX = 5.7;
  parts.push({ geometry: box(0.5, 12.5, 0.5), color: '#d49a00', position: [mastX, 6.25, -1.5] });
  for (let y = 1.5; y < 12; y += 1.5) parts.push({ geometry: box(0.56, 0.08, 0.56), color: '#a87a00', position: [mastX, y, -1.5] });

  // Bricks on pallets and cement bags at the foot.
  parts.push(
    { geometry: box(1.3, 0.15, 1.0), color: '#a8743f', position: [-2.5, 0.08, -6.0] },
    { geometry: rbox(1.2, 0.7, 0.9, 0.05), color: BRICK, position: [-2.5, 0.5, -6.0] },
    { geometry: box(1.3, 0.15, 1.0), color: '#a8743f', position: [-0.8, 0.08, -6.2] },
    { geometry: rbox(1.2, 0.5, 0.9, 0.05), color: BRICK, position: [-0.8, 0.4, -6.2] },
    { geometry: rbox(0.7, 0.25, 0.45, 0.1), color: '#e6dcc4', position: [1.0, 0.13, -6.0] },
    { geometry: rbox(0.7, 0.25, 0.45, 0.1), color: '#e6dcc4', position: [1.1, 0.38, -6.05], rotation: [0, 0.3, 0] },
  );

  // The hoist cage glides up and down the mast.
  const cage = part(
    [
      { geometry: rbox(1.6, 1.8, 1.6, 0.1), color: TOY.YELLOW, position: [mastX + 1.05, 1.1, -1.5] },
      { geometry: box(0.06, 1.2, 1.3), color: '#4b4e53', position: [mastX + 1.86, 1.2, -1.5] },
      { geometry: box(1.7, 0.08, 1.7), color: '#4b4e53', position: [mastX + 1.05, 2.04, -1.5] },
    ],
    [0, 0, 0],
    { type: 'shuttle', vector: [0, 8.6, 0], period: 16 },
  );
  return model(parts, { parts: [cage] });
}

function crane(): PropModel {
  const parts: ColoredPart[] = [{ geometry: rbox(3, 0.8, 3, 0.15, 2), color: '#c9c6bf', position: [0, 0.4, 0] }];
  for (let i = 0; i < 6; i++) {
    const y = 1.8 + i * 2;
    parts.push({ geometry: rbox(1, 2, 1, 0.08), color: i % 2 ? YELLOW : '#f0b000', position: [0, y, 0] });
    // Diagonal lattice braces on the front and back faces.
    for (const z of [-0.52, 0.52]) {
      parts.push({ geometry: box(0.08, 2.1, 0.04), color: '#d49a00', position: [0, y, z], rotation: [0, 0, (i % 2 ? 1 : -1) * 0.45] });
    }
  }
  const slewing = part(
    [
      { geometry: rbox(1.4, 1.4, 1.6, 0.18, 2), color: YELLOW, position: [0, 13.2, 0.8] },
      { geometry: rbox(1.0, 0.6, 0.05, 0.04), color: GLASS, position: [0, 13.4, -0.02] },
      { geometry: rbox(0.6, 0.6, 14, 0.1), color: YELLOW, position: [0, 14.2, -5] },
      { geometry: rbox(0.6, 0.6, 5, 0.1), color: YELLOW, position: [0, 14.2, 4.5] },
      { geometry: rbox(1.4, 1.2, 1.6, 0.15), color: '#8c8f94', position: [0, 13.6, 6.2] },
      { geometry: cyl(0.03, 0.03, 7, 4), color: DARK, position: [0, 10.6, -10] },
      { geometry: rbox(0.5, 0.4, 0.5, 0.1), color: '#ff4d3d', position: [0, 7.0, -10] },
      { geometry: cyl(0.04, 0.12, 0.3, 6), color: DARK, position: [0, 6.65, -10] },
    ],
    [0, 12.6, 0],
    { type: 'spin', axis: 'y', speed: 0.1 },
  );
  return model(parts, { parts: [slewing] });
}

// ---------------------------------------------------------------- Nature

function pine(): PropModel {
  return model(
    [
      { geometry: cyl(0.2, 0.3, 1.6, 8), color: BROWN, position: [0, 0.8, 0] },
      { geometry: ico(0.35, 0), color: '#6b4a2e', position: [0, 0.05, 0], scale: [1.4, 0.4, 1.4] },
    ],
    {
      parts: [
        part(
          [
            { geometry: cyl(0.6, 2.2, 2.4, 9), color: PINE_GREEN, position: [0, 2.6, 0] },
            { geometry: cyl(0.45, 1.75, 2.2, 9), color: '#3a7a48', position: [0, 3.9, 0] },
            { geometry: cyl(0.25, 1.25, 1.9, 9), color: '#448856', position: [0, 5.05, 0] },
            { geometry: cone(0.55, 1.1, 9), color: '#4f965f', position: [0, 6.3, 0] },
          ],
          [0, 1.4, 0],
          { type: 'swing', axis: 'z', amplitude: 0.02, speed: 1.1 },
        ),
      ],
    },
  );
}

function roundTree(): PropModel {
  return model([{ geometry: cyl(0.18, 0.28, 2.2, 8), color: BROWN, position: [0, 1.1, 0] }], {
    parts: [
      part(
        [
          { geometry: ico(1.7, 1), color: LEAF_GREEN, position: [0, 3.3, 0] },
          { geometry: ico(1.15, 1), color: '#66b351', position: [0.95, 3.85, 0.3] },
          { geometry: ico(1.05, 1), color: '#4e9a3e', position: [-0.85, 3.65, -0.4] },
          { geometry: ico(0.9, 1), color: '#72bd5c', position: [0.1, 4.5, -0.2] },
        ],
        [0, 2, 0],
        { type: 'swing', axis: 'z', amplitude: 0.025, speed: 1.3 },
      ),
    ],
  });
}

function rock(): PropModel {
  return model([
    { geometry: ico(1, 1), color: '#9a9a96', position: [0, 0.42, 0], scale: [1.3, 0.72, 1] },
    { geometry: ico(0.55, 1), color: '#8a8b88', position: [0.95, 0.24, 0.4], scale: [1, 0.8, 1.1] },
    { geometry: ico(0.3, 0), color: '#7fa25c', position: [-0.4, 0.82, 0.1], scale: [1.4, 0.35, 1.2] },
  ]);
}

function bush(): PropModel {
  const parts: ColoredPart[] = [
    { geometry: ico(0.85, 1), color: '#4f9a3c', position: [0, 0.6, 0] },
    { geometry: ico(0.6, 1), color: '#5daa48', position: [0.7, 0.45, 0.2] },
    { geometry: ico(0.55, 1), color: '#468a35', position: [-0.6, 0.42, -0.25] },
  ];
  for (const [x, y, z] of [
    [0.3, 1.2, -0.55],
    [-0.45, 0.95, 0.55],
    [0.95, 0.75, -0.2],
  ]) {
    parts.push({ geometry: ico(0.09, 0), color: '#e8453c', position: [x, y, z] });
  }
  return model(parts);
}

function flowers(): PropModel {
  const parts: ColoredPart[] = [{ geometry: ico(0.75, 1), color: '#5aa646', position: [0, 0.18, 0], scale: [1.3, 0.32, 1.1] }];
  const colors = ['#ff5b6e', '#ffd23f', '#ff8fd0', '#ffffff', '#b07cff'];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = 0.25 + (i % 3) * 0.2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    parts.push(
      { geometry: cyl(0.02, 0.02, 0.3, 4), color: '#3f8a35', position: [x, 0.38, z] },
      { geometry: ico(0.12, 0), color: colors[i % colors.length], position: [x, 0.56, z], scale: [1, 0.55, 1] },
      { geometry: ico(0.045, 0), color: '#ffd23f', position: [x, 0.6, z] },
    );
  }
  return model(parts);
}

function log(): PropModel {
  return model([
    { geometry: cyl(0.35, 0.35, 3, 12), color: '#8a5a3a', position: [0, 0.35, 0], rotation: SIDEWAYS },
    { geometry: cyl(0.3, 0.3, 3.04, 12), color: '#d9b27c', position: [0, 0.35, 0], rotation: SIDEWAYS },
    { geometry: cyl(0.16, 0.16, 3.06, 10), color: '#c49a64', position: [0, 0.35, 0], rotation: SIDEWAYS },
    // A little mushroom friend.
    { geometry: cyl(0.04, 0.05, 0.22, 6), color: '#f2ecd9', position: [0.8, 0.8, 0.12] },
    { geometry: dome(0.12, 8), color: '#e8453c', position: [0.8, 0.9, 0.12] },
  ]);
}

function viewpoint(): PropModel {
  return model([
    { geometry: cyl(0.07, 0.07, 1.3, 6), color: BROWN, position: [-0.7, 0.65, 0] },
    { geometry: cyl(0.07, 0.07, 1.3, 6), color: BROWN, position: [0.7, 0.65, 0] },
    { geometry: rbox(1.8, 1, 0.1, 0.08, 2), color: '#6b4426', position: [0, 1.6, 0] },
    { geometry: rbox(1.6, 0.8, 0.04, 0.06, 1), color: '#86b3d6', position: [0, 1.6, -0.05] },
    { geometry: cone(0.38, 0.5, 3), color: '#5c7f63', position: [-0.25, 1.48, -0.08], scale: [1, 1, 0.1] },
    { geometry: cone(0.3, 0.4, 3), color: '#7a9a83', position: [0.28, 1.43, -0.08], scale: [1, 1, 0.1] },
    { geometry: cone(0.12, 0.15, 3), color: WHITE, position: [-0.25, 1.67, -0.09], scale: [1, 1, 0.1] },
    { geometry: cyl(0.1, 0.1, 0.03, 10), color: '#ffd23f', position: [0.55, 1.82, -0.08], rotation: FACING_Z },
  ]);
}

function sailboat(): PropModel {
  // Pointed hull: wide at the stern, narrow at the bow (front = -Z).
  const hull: [number, number][] = [
    [-0.75, 0.6],
    [-0.55, 0],
    [0.55, 0],
    [0.75, 0.6],
  ];
  return model(
    [
      { geometry: extrudeProfile(hull, 3.6, 0.04), color: WHITE, position: [0, 0, 0.2] },
      { geometry: cone(0.75, 1.1, 4), color: WHITE, position: [0, 0.3, -2.1], rotation: [-Math.PI / 2, Math.PI / 4, 0], scale: [1, 1, 0.55] },
      { geometry: rbox(1.25, 0.08, 3.2, 0.03), color: '#c79a63', position: [0, 0.62, 0.2] },
      { geometry: rbox(1.54, 0.08, 3.64, 0.03), color: '#2f8fd0', position: [0, 0.4, 0.2] },
    ],
    {
      parts: [
        part(
          [
            { geometry: cyl(0.05, 0.06, 4.5, 6), color: GREY, position: [0, 2.9, 0.2] },
            { geometry: cone(1.1, 3.6, 3), color: '#fff7e6', position: [0, 2.6, 0.95], scale: [0.05, 1, 1] },
            { geometry: cone(0.7, 2.6, 3), color: '#ff6b5a', position: [0, 2.1, -0.6], scale: [0.05, 1, 1] },
            { geometry: rbox(0.06, 0.06, 1.6, 0.02), color: WOOD, position: [0, 1.0, 0.95] },
          ],
          [0, 0.6, 0],
          { type: 'swing', axis: 'z', amplitude: 0.06, speed: 1.2 },
        ),
      ],
    },
  );
}

/** A thin rod between two points (cables, struts). */
function rod(a: [number, number, number], b: [number, number, number], r: number, color: string): ColoredPart {
  const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  return {
    geometry: cyl(r, r, len, 5),
    color,
    position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    rotation: [e.x, e.y, e.z],
  };
}

/**
 * A small mountain with a gondola up its side (Sea to Sky style, simplified).
 * Faces the road (-Z): base station near the road, summit station up the slope behind.
 * Cabins glide up one cable and down the other, disappearing into the stations.
 */
function gondola(): PropModel {
  const CABLE = '#3c3f44';
  const STATION = '#7a5a3e';
  // Mountain: apex at (0, 40, 30); its surface height at horizontal distance ρ is 40·(1 − ρ/28).
  const parts: ColoredPart[] = [
    { geometry: cone(28, 40, 8), color: '#4f7058', position: [0, 20, 30] },
    { geometry: cone(8.4, 12, 8), color: '#f4f8fb', position: [0, 34.05, 30] },
    { geometry: ico(3, 0), color: '#8a8b88', position: [-9, 14, 22], scale: [1.4, 0.6, 1] },
    // Base station with a roof, and the summit lodge.
    { geometry: rbox(8, 6, 6, 0.3), color: STATION, position: [0, 3, -14] },
    { geometry: prism(7, 2.4, 9), color: '#3f4a3a', position: [0, 6, -14], rotation: [0, Math.PI / 2, 0] },
    { geometry: box(5, 2.2, 0.1), color: GLASS, position: [0, 3, -17.05] },
    { geometry: rbox(6.5, 5, 6.5, 0.3), color: STATION, position: [0, 36.2, 27] },
    { geometry: prism(7.5, 2, 7), color: '#3f4a3a', position: [0, 38.7, 27], rotation: [0, Math.PI / 2, 0] },
  ];
  // Little pines dotted on the slopes.
  for (const [x, z] of [
    [-10, 12],
    [9, 14],
    [-14, 26],
    [12, 30],
    [-6, 40],
  ]) {
    const rho = Math.hypot(x, z - 30);
    const y = 40 * (1 - rho / 28);
    parts.push({ geometry: cone(1.6, 4, 7), color: PINE_GREEN, position: [x, y + 1.8, z] });
  }

  // Two cables (up on the left, down on the right), with two pylons.
  const A: [number, number, number] = [0, 5.4, -12.5];
  const B: [number, number, number] = [0, 37.3, 26.5];
  const at = (t: number, x: number): [number, number, number] => [x, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
  for (const x of [-1.4, 1.4]) parts.push(rod(at(0, x), at(1, x), 0.05, CABLE));
  for (const t of [0.36, 0.7]) {
    const top = at(t, 0);
    const rho = Math.abs(30 - top[2]);
    const ground = rho < 28 ? 40 * (1 - rho / 28) : 0;
    parts.push(
      { geometry: cyl(0.25, 0.45, top[1] - ground, 6), color: '#9aa3ab', position: [0, (top[1] + ground) / 2 - 0.2, top[2]] },
      { geometry: rbox(4, 0.4, 0.5, 0.1), color: '#9aa3ab', position: [0, top[1] - 0.1, top[2]] },
    );
  }

  // Cabins: four per cable, spaced exactly one slide-step apart.
  const N = 4;
  const step: [number, number, number] = [0, (B[1] - A[1]) / N, (B[2] - A[2]) / N];
  const cabins = (x: number, from: number, dir: 1 | -1): ColoredPart[] =>
    Array.from({ length: N }, (_, k): ColoredPart[] => {
      const p = at(from + (dir * k) / N, x);
      return [
        { geometry: box(0.08, 1.3, 0.08), color: CABLE, position: [p[0], p[1] - 0.6, p[2]] },
        { geometry: rbox(1.5, 1.4, 1.7, 0.35), color: '#d8433b', position: [p[0], p[1] - 1.9, p[2]] },
        { geometry: box(1.54, 0.5, 1.4), color: GLASS, position: [p[0], p[1] - 1.75, p[2]] },
      ];
    }).flat();
  const period = 9; // ~1.3 m/s along the cable
  return model(parts, {
    parts: [
      part(cabins(-1.4, 0, 1), [0, 0, 0], { type: 'slide', vector: step, period }),
      part(cabins(1.4, 1, -1), [0, 0, 0], { type: 'slide', vector: [0, -step[1], -step[2]], period }),
    ],
  });
}

// ---------------------------------------------------------------- Farm

function fence(): PropModel {
  const parts: ColoredPart[] = [];
  for (const x of [-1.8, -0.6, 0.6, 1.8]) {
    parts.push(
      { geometry: rbox(0.15, 1.05, 0.15, 0.04), color: '#f2efe6', position: [x, 0.52, 0] },
      { geometry: cone(0.11, 0.14, 4), color: '#f2efe6', position: [x, 1.12, 0], rotation: [0, Math.PI / 4, 0] },
    );
  }
  parts.push({ geometry: rbox(3.9, 0.14, 0.08, 0.03), color: '#f2efe6', position: [0, 0.85, 0.05] });
  parts.push({ geometry: rbox(3.9, 0.14, 0.08, 0.03), color: '#f2efe6', position: [0, 0.45, 0.05] });
  return model(parts);
}

function barn(): PropModel {
  return model([
    { geometry: rbox(6.4, 4.5, 8, 0.12), color: '#c8402f', position: [0, 2.25, 0] },
    { geometry: prism(7, 2.8, 8.6), color: '#8f2a22', position: [0, 4.5, 0] },
    // White corner trims.
    { geometry: rbox(0.2, 4.5, 0.2, 0.05), color: WHITE, position: [-3.2, 2.25, -4.0] },
    { geometry: rbox(0.2, 4.5, 0.2, 0.05), color: WHITE, position: [3.2, 2.25, -4.0] },
    { geometry: rbox(6.6, 0.2, 0.2, 0.05), color: WHITE, position: [0, 4.5, -4.05] },
    // Big doors with the classic X.
    { geometry: rbox(2.7, 3.1, 0.1, 0.04), color: WHITE, position: [0, 1.55, -4.02] },
    { geometry: rbox(2.4, 2.8, 0.12, 0.03), color: '#a8352a', position: [0, 1.55, -4.05] },
    { geometry: box(0.15, 3.4, 0.14), color: WHITE, position: [0, 1.55, -4.1], rotation: [0, 0, 0.71] },
    { geometry: box(0.15, 3.4, 0.14), color: WHITE, position: [0, 1.55, -4.1], rotation: [0, 0, -0.71] },
    // Hayloft door.
    { geometry: rbox(1.3, 1.1, 0.1, 0.04), color: WHITE, position: [0, 5.35, -4.05] },
    { geometry: rbox(1.05, 0.85, 0.12, 0.03), color: '#5a2a1e', position: [0, 5.35, -4.08] },
    // Little cupola on the ridge.
    { geometry: rbox(0.9, 0.8, 0.9, 0.06), color: WHITE, position: [0, 7.6, 0] },
    { geometry: cone(0.75, 0.6, 4), color: '#8f2a22', position: [0, 8.3, 0], rotation: [0, Math.PI / 4, 0] },
  ]);
}

function silo(): PropModel {
  const parts: ColoredPart[] = [
    { geometry: cyl(1.6, 1.6, 9, 16), color: '#d9d6cf', position: [0, 4.5, 0] },
    { geometry: dome(1.62, 14), color: '#9aa5ad', position: [0, 9, 0] },
    { geometry: cyl(0.12, 0.12, 0.3, 6), color: '#9aa5ad', position: [0, 10.7, 0] },
  ];
  for (const y of [2, 4, 6, 8]) parts.push({ geometry: cyl(1.65, 1.65, 0.16, 16), color: '#b8bcc0', position: [0, y, 0] });
  // Ladder on the front.
  for (const x of [-0.22, 0.22]) parts.push({ geometry: box(0.05, 8.6, 0.05), color: STEEL, position: [x, 4.6, -1.66] });
  for (let i = 0; i < 12; i++) parts.push({ geometry: box(0.44, 0.04, 0.05), color: STEEL, position: [0, 0.8 + i * 0.7, -1.66] });
  return model(parts);
}

function hayBale(): PropModel {
  return model([
    { geometry: cyl(0.8, 0.8, 1.2, 16), color: '#e3c063', position: [0, 0.8, 0], rotation: SIDEWAYS },
    { geometry: cyl(0.66, 0.66, 1.24, 16), color: '#f0d27a', position: [0, 0.8, 0], rotation: SIDEWAYS },
    { geometry: cyl(0.3, 0.3, 1.26, 12), color: '#e6c56c', position: [0, 0.8, 0], rotation: SIDEWAYS },
    { geometry: cyl(0.82, 0.82, 0.06, 16), color: '#c9a24a', position: [-0.3, 0.8, 0], rotation: SIDEWAYS },
    { geometry: cyl(0.82, 0.82, 0.06, 16), color: '#c9a24a', position: [0.3, 0.8, 0], rotation: SIDEWAYS },
  ]);
}

function cow(): PropModel {
  const legs: ColoredPart[] = [];
  for (const [x, z] of [
    [-0.32, -0.6],
    [0.32, -0.6],
    [-0.32, 0.6],
    [0.32, 0.6],
  ]) {
    legs.push(
      { geometry: cyl(0.11, 0.1, 0.7, 8), color: '#f7f7f2', position: [x, 0.35, z] },
      { geometry: cyl(0.115, 0.115, 0.12, 8), color: '#3a3a3a', position: [x, 0.06, z] },
    );
  }
  return model(
    [
      { geometry: rbox(1.05, 0.95, 1.85, 0.22), color: '#f7f7f2', position: [0, 1.1, 0] },
      // Spots sit just proud of the body.
      { geometry: rbox(1.08, 0.5, 0.6, 0.15, 1), color: '#2e2e2e', position: [0, 1.25, 0.35] },
      { geometry: rbox(0.5, 0.42, 0.5, 0.14, 1), color: '#2e2e2e', position: [0.3, 1.32, -0.45] },
      { geometry: ico(0.2, 1), color: '#ffb3b8', position: [0, 0.62, 0.35], scale: [1.2, 0.6, 1] },
      { geometry: cyl(0.03, 0.03, 0.75, 4), color: '#f7f7f2', position: [0, 1.0, 0.98], rotation: [0.2, 0, 0] },
      { geometry: ico(0.07, 0), color: '#2e2e2e', position: [0, 0.62, 1.05] },
      ...legs,
    ],
    {
      parts: [
        part(
          [
            { geometry: rbox(0.6, 0.6, 0.72, 0.16), color: '#f7f7f2', position: [0, 1.25, -1.2] },
            { geometry: rbox(0.52, 0.32, 0.28, 0.1, 1), color: '#ffb3b8', position: [0, 1.08, -1.58] },
            { geometry: ico(0.05, 0), color: '#26282c', position: [-0.17, 1.4, -1.55] },
            { geometry: ico(0.05, 0), color: '#26282c', position: [0.17, 1.4, -1.55] },
            { geometry: rbox(0.28, 0.1, 0.16, 0.04), color: '#2e2e2e', position: [-0.38, 1.45, -1.1] },
            { geometry: rbox(0.28, 0.1, 0.16, 0.04), color: '#2e2e2e', position: [0.38, 1.45, -1.1] },
            { geometry: cone(0.05, 0.22, 6), color: '#e8e0c8', position: [-0.2, 1.65, -1.1] },
            { geometry: cone(0.05, 0.22, 6), color: '#e8e0c8', position: [0.2, 1.65, -1.1] },
          ],
          [0, 1.3, -0.9],
          { type: 'swing', axis: 'x', amplitude: 0.25, speed: 0.6, bias: -0.25 },
        ),
      ],
    },
  );
}

function sheep(): PropModel {
  const parts: ColoredPart[] = [];
  // A fluffy cloud body from several puffs.
  for (const [x, y, z, r] of [
    [0, 0.9, 0, 0.55],
    [0.25, 1.0, -0.35, 0.42],
    [-0.25, 1.0, -0.3, 0.42],
    [0.25, 0.95, 0.35, 0.42],
    [-0.25, 0.95, 0.35, 0.42],
    [0, 1.15, 0.05, 0.4],
  ]) {
    parts.push({ geometry: ico(r, 1), color: '#fbfbf6', position: [x, y, z] });
  }
  for (const [x, z] of [
    [-0.22, -0.35],
    [0.22, -0.35],
    [-0.22, 0.35],
    [0.22, 0.35],
  ]) {
    parts.push({ geometry: cyl(0.06, 0.06, 0.55, 6), color: '#2e2e2e', position: [x, 0.27, z] });
  }
  parts.push(
    { geometry: rbox(0.36, 0.4, 0.46, 0.12), color: '#2e2e2e', position: [0, 1.05, -0.8] },
    { geometry: rbox(0.22, 0.08, 0.12, 0.04), color: '#2e2e2e', position: [-0.25, 1.12, -0.72] },
    { geometry: rbox(0.22, 0.08, 0.12, 0.04), color: '#2e2e2e', position: [0.25, 1.12, -0.72] },
    { geometry: ico(0.04, 0), color: WHITE, position: [-0.1, 1.15, -1.03] },
    { geometry: ico(0.04, 0), color: WHITE, position: [0.1, 1.15, -1.03] },
  );
  return model(parts);
}

function windmill(): PropModel {
  const blades: ColoredPart[] = [
    { geometry: cyl(0.3, 0.3, 0.3, 10), color: GREY, position: [0, 9, -1.0], rotation: FACING_Z },
    { geometry: cone(0.18, 0.3, 8), color: GREY, position: [0, 9, -1.3], rotation: [-Math.PI / 2, 0, 0] },
  ];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    blades.push(
      { geometry: rbox(0.08, 4.2, 0.08, 0.02), color: WOOD, position: [Math.sin(a) * 2.2, 9 + Math.cos(a) * 2.2, -1.05], rotation: [0, 0, -a] },
      {
        geometry: rbox(0.55, 3.4, 0.05, 0.03),
        color: '#f6f1e4',
        position: [Math.sin(a) * 2.5 + Math.cos(a) * 0.3, 9 + Math.cos(a) * 2.5 - Math.sin(a) * 0.3, -1.08],
        rotation: [0, 0, -a],
      },
    );
  }
  return model(
    [
      { geometry: cyl(0.75, 1.4, 9, 10), color: '#f3efe6', position: [0, 4.5, 0] },
      { geometry: rbox(1.7, 1.4, 2, 0.2, 2), color: '#c8402f', position: [0, 9, 0] },
      { geometry: cone(1.1, 1.0, 4), color: '#8f2a22', position: [0, 10.2, 0], rotation: [0, Math.PI / 4, 0] },
      { geometry: rbox(0.9, 1.6, 0.1, 0.05), color: BROWN, position: [0, 0.8, -1.3] },
      { geometry: rbox(0.5, 0.5, 0.06, 0.04), color: GLASS, position: [0, 4.2, -1.05], rotation: [-0.07, 0, 0] },
      { geometry: rbox(0.45, 0.45, 0.06, 0.04), color: GLASS, position: [0, 6.6, -0.88], rotation: [-0.07, 0, 0] },
    ],
    { parts: [part(blades, [0, 9, -1.0], { type: 'spin', axis: 'z', speed: 0.8 })] },
  );
}

// ---------------------------------------------------------------- City

const HOUSE_TINTS = ['#ffe0b8', '#cfe8ff', '#ffd0d8', '#e0f5d0', '#fff4b8', '#e9dcff'];

/** A window with a white frame and sill on the front face (z = front). */
function framedWindow(x: number, y: number, z: number, w: number, h: number): ColoredPart[] {
  return [
    { geometry: rbox(w + 0.16, h + 0.16, 0.06, 0.04), color: WHITE, position: [x, y, z] },
    { geometry: rbox(w, h, 0.08, 0.03), color: GLASS, position: [x, y, z - 0.01] },
    { geometry: rbox(w + 0.25, 0.08, 0.16, 0.03), color: WHITE, position: [x, y - h / 2 - 0.1, z - 0.04] },
  ];
}

function house(): PropModel {
  return model(
    [
      { geometry: rbox(5, 3.2, 5, 0.12, 1), color: WHITE, position: [0, 1.6, 0] },
      { geometry: prism(5.8, 2.2, 5.8), color: '#c4614f', position: [0, 3.2, 0] },
      { geometry: rbox(0.55, 1.3, 0.55, 0.06), color: '#9a5a4a', position: [1.4, 4.4, 0.8] },
      // Door with a knob, step and little roof.
      { geometry: rbox(1.0, 2.0, 0.1, 0.04), color: '#8a5a3a', position: [0, 1.0, -2.52] },
      { geometry: ico(0.06, 0), color: '#d9b84a', position: [0.32, 1.0, -2.6] },
      { geometry: rbox(1.4, 0.15, 0.5, 0.04), color: '#bdb9b0', position: [0, 0.08, -2.75] },
      { geometry: rbox(1.4, 0.1, 0.5, 0.03), color: '#c4614f', position: [0, 2.2, -2.75], rotation: [-0.2, 0, 0] },
      ...framedWindow(-1.5, 1.9, -2.52, 1.0, 0.9),
      ...framedWindow(1.5, 1.9, -2.52, 1.0, 0.9),
    ],
    { tints: HOUSE_TINTS },
  );
}

function building(): PropModel {
  const parts: ColoredPart[] = [
    { geometry: rbox(8, 10, 7, 0.15, 1), color: WHITE, position: [0, 5, 0] },
    { geometry: rbox(8.3, 0.4, 7.3, 0.1), color: '#9a9ca0', position: [0, 10.2, 0] },
    { geometry: rbox(1.6, 0.8, 1.2, 0.08), color: '#b8bcc0', position: [2, 10.8, 1] },
    // Entrance with a canopy.
    { geometry: rbox(1.8, 2.4, 0.1, 0.04), color: '#5a6a7a', position: [0, 1.2, -3.52] },
    { geometry: rbox(2.6, 0.12, 1.0, 0.04), color: '#5a6a7a', position: [0, 2.6, -3.9] },
  ];
  for (let floor = 1; floor < 4; floor++) {
    for (const x of [-2.6, 0, 2.6]) parts.push(...framedWindow(x, 1.2 + floor * 2.6, -3.52, 1.4, 1.3));
  }
  return model(parts, { tints: ['#f2d7c0', '#d8e4f0', '#f0e6c8', '#e2d8ec', '#d4ecd8'] });
}

function shop(): PropModel {
  const parts: ColoredPart[] = [
    { geometry: rbox(6, 3.6, 5, 0.12, 1), color: WHITE, position: [0, 1.8, 0] },
    { geometry: rbox(6.2, 0.3, 5.2, 0.08), color: '#9a9ca0', position: [0, 3.75, 0] },
    // Shop window, door and a sign board.
    { geometry: rbox(4.3, 1.9, 0.06, 0.05), color: WHITE, position: [-0.6, 1.4, -2.52] },
    { geometry: rbox(4.1, 1.7, 0.08, 0.04), color: GLASS, position: [-0.6, 1.4, -2.53] },
    { geometry: rbox(0.95, 2.2, 0.1, 0.04), color: '#5a6a7a', position: [2.2, 1.1, -2.52] },
    { geometry: rbox(3.2, 0.55, 0.12, 0.06), color: '#2f8fd0', position: [-0.6, 3.25, -2.58] },
  ];
  // Rounded striped awning (squashed rolls).
  for (let i = 0; i < 6; i++) {
    const g = cyl(0.5, 0.5, 1.0, 10);
    g.rotateZ(Math.PI / 2);
    parts.push({ geometry: g, color: i % 2 ? WHITE : '#e8453c', position: [-2.5 + i, 2.75, -2.75], scale: [1, 0.55, 1] });
  }
  return model(parts, { tints: ['#ffe9c8', '#d6f0ff', '#ffe0ec', '#e6f7d6'] });
}

function trafficLight(): PropModel {
  const lamp = (y: number, color: string, from: number, to: number) =>
    part([{ geometry: cyl(0.13, 0.13, 0.08, 12), color, position: [0, y, -0.21], rotation: FACING_Z }], [0, y, -0.21], {
      type: 'cycle',
      period: 9,
      from,
      to,
    }, true);
  const body: ColoredPart[] = [
    { geometry: cyl(0.07, 0.1, 3.4, 8), color: '#5b5e63', position: [0, 1.7, 0] },
    { geometry: rbox(0.36, 0.1, 0.36, 0.04), color: '#5b5e63', position: [0, 0.05, 0] },
    { geometry: rbox(0.46, 1.3, 0.34, 0.1, 2), color: '#2b2d31', position: [0, 3.95, 0] },
  ];
  for (const [y, dim] of [
    [4.35, '#4a1c1c'],
    [3.95, '#4a3d14'],
    [3.55, '#173d1f'],
  ] as const) {
    // Open half-tube hood above the lamp (top half only, so the lamp stays visible).
    const visor = new THREE.CylinderGeometry(0.17, 0.17, 0.2, 10, 1, true, Math.PI / 2, Math.PI);
    visor.rotateX(Math.PI / 2);
    body.push(
      { geometry: cyl(0.13, 0.13, 0.05, 12), color: dim, position: [0, y, -0.18], rotation: FACING_Z },
      { geometry: visor, color: '#2b2d31', position: [0, y, -0.3] },
    );
  }
  return model(body, {
    parts: [lamp(3.55, '#3ee06a', 0, 0.5), lamp(3.95, '#ffcc33', 0.5, 0.6), lamp(4.35, '#ff4040', 0.6, 1)],
  });
}

function streetLamp(): PropModel {
  return model([
    { geometry: rbox(0.36, 0.3, 0.36, 0.06), color: '#4b4e53', position: [0, 0.15, 0] },
    { geometry: cyl(0.07, 0.11, 4.5, 8), color: '#5b5e63', position: [0, 2.4, 0] },
    { geometry: rbox(0.09, 0.09, 1.3, 0.04), color: '#5b5e63', position: [0, 4.6, -0.6] },
    { geometry: rbox(0.42, 0.18, 0.66, 0.08, 2), color: '#3c3f44', position: [0, 4.5, -1.2] },
    { geometry: rbox(0.32, 0.05, 0.52, 0.02), color: '#fff3c4', position: [0, 4.4, -1.2] },
  ]);
}

/** Slim glass condo tower on a stone podium, with white balcony lines ("Vancouverism"). */
function glassTower(): PropModel {
  const parts: ColoredPart[] = [
    { geometry: rbox(10, 6, 9, 0.2), color: '#d9d4c7', position: [0, 3, 0] },
    { geometry: box(9.4, 3.2, 0.1), color: GLASS, position: [0, 1.8, -4.52] },
    { geometry: rbox(9.6, 0.3, 0.9, 0.08), color: '#9a9ca0', position: [0, 3.6, -4.8] },
    { geometry: rbox(6, 30, 6, 0.3), color: '#6fb7c9', position: [0.8, 21, 0.5] },
    { geometry: rbox(2.4, 1.8, 2.4, 0.15), color: '#c9cdd2', position: [0.8, 36.9, 0.5] },
    { geometry: box(0.15, 1.2, 0.15), color: '#c9cdd2', position: [0.8, 38.4, 0.5] },
  ];
  // Balcony slabs every three metres.
  for (let y = 8.5; y < 36; y += 3) parts.push({ geometry: box(6.3, 0.16, 6.3), color: '#f2f2f2', position: [0.8, y, 0.5] });
  // A vertical frame stripe on the front.
  parts.push({ geometry: box(0.3, 30, 0.1), color: '#f2f2f2', position: [0.8, 21, -2.53] });
  return model(parts, { tints: ['#ffffff', '#e0f0ff', '#e6fff0', '#efeaff'] });
}

function blossomTree(): PropModel {
  return model([{ geometry: cyl(0.16, 0.26, 2.1, 8), color: '#5a3a2a', position: [0, 1.05, 0] }], {
    parts: [
      part(
        [
          { geometry: ico(1.6, 1), color: '#f7b6cf', position: [0, 3.1, 0] },
          { geometry: ico(1.05, 1), color: '#f29cbf', position: [0.9, 3.6, 0.3] },
          { geometry: ico(1.0, 1), color: '#fbd0e0', position: [-0.8, 3.5, -0.4] },
          { geometry: ico(0.8, 1), color: '#ffe0ec', position: [0.1, 4.2, -0.2] },
        ],
        [0, 1.9, 0],
        { type: 'swing', axis: 'z', amplitude: 0.025, speed: 1.3 },
      ),
    ],
  });
}

/** Geodesic dome on columns by the water (Science World, simplified). */
function scienceWorld(): PropModel {
  const parts: ColoredPart[] = [
    { geometry: cyl(10, 10.5, 0.4, 24), color: '#cfccc5', position: [0, 0.2, 0] },
    { geometry: cyl(3.2, 3.6, 6.2, 12), color: '#5e8fae', position: [0, 3.3, 0] },
    // Faceted silver sphere — flat shading makes the icosphere read as a geodesic dome.
    { geometry: ico(8, 2), color: '#d5dce2', position: [0, 13.6, 0] },
    { geometry: cyl(5.6, 5.6, 0.6, 20), color: '#9aa3ab', position: [0, 6.1, 0] },
  ];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push({ geometry: cyl(0.35, 0.45, 6.2, 8), color: '#e8e6e1', position: [Math.cos(a) * 4.6, 3.3, Math.sin(a) * 4.6] });
  }
  return model(parts);
}

/** Pier building with white tent "sails" on the roof (Canada Place, simplified). Long side along X. */
function canadaPlace(): PropModel {
  const parts: ColoredPart[] = [
    { geometry: rbox(24, 3.4, 10, 0.25), color: '#e7e5e0', position: [0, 1.7, 0] },
    { geometry: box(23.4, 1.2, 0.1), color: GLASS, position: [0, 2.0, -5.02] },
    { geometry: rbox(26, 0.5, 12, 0.15), color: '#9a9ca0', position: [0, 0.25, 0] },
  ];
  // Five sails, alternating heights, slightly overlapping.
  for (let i = 0; i < 5; i++) {
    const x = -9 + i * 4.5;
    const h = i % 2 ? 6.2 : 7.4;
    parts.push({ geometry: cone(3.1, h, 4), color: '#fbfbf8', position: [x, 3.4 + h / 2, 0.4], rotation: [0, Math.PI / 4, 0], scale: [1, 1, 1.25] });
  }
  for (const x of [-11, 11]) parts.push({ geometry: cyl(0.08, 0.08, 6, 5), color: GREY, position: [x, 6.4, -4] });
  return model(parts);
}

/** Concrete tower with an outside yellow elevator and a lookout "saucer" (Harbour Centre, simplified). */
function harbourCentre(): PropModel {
  const parts: ColoredPart[] = [
    { geometry: rbox(9, 4, 9, 0.2), color: '#cfcac0', position: [0, 2, 0] },
    { geometry: rbox(6, 38, 6, 0.2), color: '#d8d4cc', position: [0, 23, 0] },
    { geometry: box(1.0, 38, 0.35), color: '#f2c230', position: [0, 23, -3.12] },
    { geometry: cyl(2, 2.4, 3, 12), color: '#b9b4aa', position: [0, 43.5, 0] },
    { geometry: cyl(6.5, 5.2, 2.6, 20), color: '#b9b4aa', position: [0, 46.3, 0] },
    { geometry: cyl(6.6, 6.6, 1.1, 20), color: '#7fb3d2', position: [0, 46.6, 0] },
    { geometry: cyl(4.4, 6.5, 1.0, 20), color: '#cfcac0', position: [0, 48.1, 0] },
    { geometry: cyl(0.12, 0.2, 5, 6), color: '#8a8f96', position: [0, 51.1, 0] },
  ];
  // Dark vertical window strips on the front and back.
  for (const x of [-2, -0.9, 0.9, 2]) {
    for (const z of [-3.04, 3.04]) parts.push({ geometry: box(0.45, 36, 0.1), color: '#6a7480', position: [x, 23, z] });
  }
  return model(parts);
}

/** Little steam clock on the sidewalk (Gastown, simplified) — it puffs steam now and then. */
function steamClock(): PropModel {
  const BRONZE = '#6b4a2e';
  const parts: ColoredPart[] = [
    { geometry: rbox(1.3, 0.6, 1.3, 0.08), color: BRONZE, position: [0, 0.3, 0] },
    { geometry: rbox(0.85, 2.4, 0.85, 0.06), color: '#7a5636', position: [0, 1.8, 0] },
    { geometry: rbox(1.15, 1.1, 1.15, 0.08), color: BRONZE, position: [0, 3.55, 0] },
    { geometry: cone(0.75, 1.0, 4), color: '#4f6a4a', position: [0, 4.6, 0], rotation: [0, Math.PI / 4, 0] },
    { geometry: cyl(0.06, 0.06, 0.6, 5), color: '#c9a24a', position: [0, 5.3, 0] },
  ];
  // Clock faces on all four sides.
  for (const [x, z, rot] of [
    [0, -0.6, FACING_Z],
    [0, 0.6, FACING_Z],
    [-0.6, 0, SIDEWAYS],
    [0.6, 0, SIDEWAYS],
  ] as const) {
    parts.push(
      { geometry: cyl(0.4, 0.4, 0.04, 14), color: '#f2ecd9', position: [x, 3.55, z], rotation: rot },
      { geometry: box(0.04, 0.3, 0.04), color: DARK, position: [x * 1.06, 3.65, z * 1.06] },
    );
  }
  const steam = part(
    [
      { geometry: ico(0.3, 1), color: WHITE, position: [0.15, 5.9, 0] },
      { geometry: ico(0.4, 1), color: WHITE, position: [-0.1, 6.4, 0.1] },
      { geometry: ico(0.5, 1), color: '#f2f4f6', position: [0.2, 7.0, -0.1] },
    ],
    [0, 5.9, 0],
    { type: 'blink', hz: 0.25, duty: 0.4 },
  );
  return model(parts, { parts: [steam] });
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
  quarry,
  pipeTrench,
  crane,
  unfinishedBuilding,
  pine,
  roundTree,
  rock,
  bush,
  flowers,
  log,
  viewpoint,
  sailboat,
  gondola,
  elk: () => wildlife('elk'),
  moose: () => wildlife('moose'),
  bear: () => wildlife('bear'),
  bighorn: () => wildlife('bighorn'),
  wolf: () => wildlife('wolf'),
  wildlifeBridge,
  snowPine,
  chalet,
  snowman,
  skiSlope,
  iceRink,
  sledHill,
  snowFort,
  snowbank,
  fox,
  hare,
  fence,
  barn,
  silo,
  hayBale,
  autumnTree,
  pumpkinPile,
  pumpkinPatch,
  harvestStand,
  harvestRide,
  scarecrow,
  leafPile,
  cornRows,
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
  glassTower,
  blossomTree,
  scienceWorld,
  canadaPlace,
  harbourCentre,
  steamClock,
};

export function buildPropModel(kind: PropKind): PropModel {
  return BUILDERS[kind]();
}

export const PROP_KINDS = Object.keys(BUILDERS) as PropKind[];
