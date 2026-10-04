import { box, cyl, ico, rbox, type ColoredPart } from './geometry';

/**
 * Shared "toy" building blocks so every vehicle in the world looks like a sibling of the
 * school bus: rounded bodies, framed glass, wheels with rims and hubs, little lights.
 * All vehicles face -Z and sit on y = 0.
 */

export const TOY = {
  DARK: '#2f3237',
  BLACK: '#26282c',
  TIRE: '#2b2d31',
  RIM: '#cfd3d8',
  HUB: '#8a8f96',
  GLASS: '#9fd7ff',
  GLASS_DARK: '#6e9fbf',
  CHROME: '#d9dde2',
  HEADLIGHT: '#fff6d6',
  TAILLIGHT: '#e8453c',
  INDICATOR: '#ffa31a',
  WHITE: '#fafafa',
  YELLOW: '#ffc21a',
  ORANGE: '#ff7a1a',
} as const;

type V3 = [number, number, number];
const SIDEWAYS: V3 = [0, 0, Math.PI / 2];
const FACING_Z: V3 = [Math.PI / 2, 0, 0];

/** Tyre + rim + hub cap on the outer side. `x` sign decides which side is "outer". */
export function toyWheel(x: number, z: number, r = 0.42, w = 0.32, rim: string = TOY.RIM): ColoredPart[] {
  const out = Math.sign(x) || 1;
  return [
    { geometry: cyl(r, r, w, 12), color: TOY.TIRE, position: [x, r, z], rotation: SIDEWAYS },
    { geometry: cyl(r * 0.62, r * 0.62, w + 0.02, 10), color: rim, position: [x, r, z], rotation: SIDEWAYS },
    { geometry: cyl(r * 0.22, r * 0.3, 0.06, 6), color: TOY.HUB, position: [x + out * (w / 2 + 0.02), r, z], rotation: SIDEWAYS },
  ];
}

/** Round headlights with chrome rims on the front face (z = front). */
export function headlights(xs: readonly number[], y: number, z: number, r = 0.13): ColoredPart[] {
  return xs.flatMap((x): ColoredPart[] => [
    { geometry: cyl(r + 0.04, r + 0.04, 0.05, 10), color: TOY.CHROME, position: [x, y, z + 0.01], rotation: FACING_Z },
    { geometry: cyl(r, r, 0.07, 10), color: TOY.HEADLIGHT, position: [x, y, z], rotation: FACING_Z },
  ]);
}

/** Rounded rectangular tail lights on the back face (z = back). */
export function taillights(xs: readonly number[], y: number, z: number, w = 0.26, h = 0.16): ColoredPart[] {
  return xs.map((x): ColoredPart => ({ geometry: rbox(w, h, 0.05, 0.03), color: TOY.TAILLIGHT, position: [x, y, z] }));
}

/** A simple bumper across the front or back. */
export function bumper(width: number, y: number, z: number, color: string = TOY.DARK): ColoredPart {
  return { geometry: rbox(width, 0.22, 0.24, 0.08), color, position: [0, y, z] };
}

/** Glass panes along both sides at the given z positions. */
export function sideWindows(halfWidth: number, y: number, zs: readonly number[], h: number, len: number): ColoredPart[] {
  return zs.flatMap((z): ColoredPart[] => [
    { geometry: rbox(0.05, h, len, 0.02), color: TOY.GLASS, position: [-halfWidth, y, z] },
    { geometry: rbox(0.05, h, len, 0.02), color: TOY.GLASS, position: [halfWidth, y, z] },
  ]);
}

// ---------------------------------------------------------------- vehicles

/** Small hatchback. White by default so instances can be tinted (parked cars). */
export function carParts(color: string = TOY.WHITE): ColoredPart[] {
  return [
    { geometry: rbox(1.8, 0.62, 4, 0.24, 2), color, position: [0, 0.7, 0] },
    // Glass cabin with a coloured roof and pillars.
    { geometry: rbox(1.54, 0.58, 2.1, 0.2, 2), color: TOY.GLASS_DARK, position: [0, 1.25, 0.2] },
    { geometry: rbox(1.6, 0.12, 1.95, 0.06, 1), color, position: [0, 1.56, 0.25] },
    { geometry: rbox(1.58, 0.5, 0.12, 0.04, 1), color, position: [0, 1.27, 0.35] },
    { geometry: rbox(1.58, 0.5, 0.1, 0.04, 1), color, position: [0, 1.27, 1.18] },
    // Bonnet and boot lips, lights, bumpers.
    ...headlights([-0.6, 0.6], 0.78, -2.0),
    ...taillights([-0.62, 0.62], 0.85, 2.0),
    { geometry: rbox(0.7, 0.18, 0.05, 0.03), color: TOY.DARK, position: [0, 0.68, -2.0] },
    bumper(1.84, 0.42, -1.98),
    bumper(1.84, 0.42, 1.98),
    // Mirrors.
    { geometry: rbox(0.14, 0.12, 0.2, 0.04), color, position: [-0.92, 1.12, -0.75] },
    { geometry: rbox(0.14, 0.12, 0.2, 0.04), color, position: [0.92, 1.12, -0.75] },
    ...toyWheel(-0.84, -1.25, 0.38, 0.3),
    ...toyWheel(0.84, -1.25, 0.38, 0.3),
    ...toyWheel(-0.84, 1.25, 0.38, 0.3),
    ...toyWheel(0.84, 1.25, 0.38, 0.3),
  ];
}

export function pickupParts(color: string): ColoredPart[] {
  return [
    { geometry: rbox(1.9, 0.72, 5, 0.22, 2), color, position: [0, 0.85, 0] },
    { geometry: rbox(1.8, 0.8, 1.9, 0.22, 2), color, position: [0, 1.6, -0.6] },
    { geometry: rbox(1.62, 0.52, 0.05, 0.03), color: TOY.GLASS, position: [0, 1.68, -1.56], rotation: [0.25, 0, 0] },
    ...sideWindows(0.91, 1.7, [-0.6], 0.42, 1.3),
    // Load bed: dark floor, side walls and tailgate.
    { geometry: rbox(1.7, 0.1, 2.2, 0.03), color: TOY.DARK, position: [0, 1.22, 1.35] },
    { geometry: rbox(0.12, 0.42, 2.3, 0.04), color, position: [-0.89, 1.42, 1.35] },
    { geometry: rbox(0.12, 0.42, 2.3, 0.04), color, position: [0.89, 1.42, 1.35] },
    { geometry: rbox(1.9, 0.42, 0.12, 0.04), color, position: [0, 1.42, 2.44] },
    { geometry: rbox(1.0, 0.36, 0.05, 0.03), color: TOY.DARK, position: [0, 0.95, -2.5] },
    ...headlights([-0.66, 0.66], 0.98, -2.5),
    ...taillights([-0.75, 0.75], 1.0, 2.5, 0.18, 0.26),
    bumper(1.96, 0.5, -2.48, TOY.CHROME),
    bumper(1.96, 0.5, 2.48, TOY.CHROME),
    ...toyWheel(-0.9, -1.6, 0.45, 0.34),
    ...toyWheel(0.9, -1.6, 0.45, 0.34),
    ...toyWheel(-0.9, 1.6, 0.45, 0.34),
    ...toyWheel(0.9, 1.6, 0.45, 0.34),
  ];
}

export function vanParts(color: string): ColoredPart[] {
  return [
    { geometry: rbox(2, 2.0, 4.8, 0.32, 2), color, position: [0, 1.35, 0] },
    { geometry: rbox(1.78, 0.72, 0.06, 0.04), color: TOY.GLASS, position: [0, 1.92, -2.39], rotation: [0.22, 0, 0] },
    ...sideWindows(1.01, 1.95, [-1.5, -0.3, 0.9], 0.55, 1.0),
    { geometry: rbox(2.04, 0.22, 4.84, 0.08), color: TOY.WHITE, position: [0, 1.12, 0] },
    { geometry: rbox(0.9, 0.3, 0.05, 0.03), color: TOY.DARK, position: [0, 0.86, -2.41] },
    ...headlights([-0.7, 0.7], 0.95, -2.41),
    ...taillights([-0.8, 0.8], 1.3, 2.41, 0.18, 0.4),
    bumper(2.04, 0.45, -2.38),
    bumper(2.04, 0.45, 2.38),
    ...toyWheel(-0.94, -1.6, 0.42, 0.32),
    ...toyWheel(0.94, -1.6, 0.42, 0.32),
    ...toyWheel(-0.94, 1.6, 0.42, 0.32),
    ...toyWheel(0.94, 1.6, 0.42, 0.32),
  ];
}

export function camperParts(): ColoredPart[] {
  return [
    ...vanParts(TOY.WHITE),
    { geometry: rbox(2.05, 0.32, 4.86, 0.1), color: '#2f8fd0', position: [0, 1.52, 0] },
    // Pop-up roof and a little ladder at the back.
    { geometry: rbox(1.72, 0.48, 2.7, 0.18, 2), color: '#f2ecd9', position: [0, 2.55, 0.5] },
    { geometry: box(0.05, 1.3, 0.05), color: TOY.CHROME, position: [0.45, 1.75, 2.43] },
    { geometry: box(0.05, 1.3, 0.05), color: TOY.CHROME, position: [0.75, 1.75, 2.43] },
  ];
}

export function cityBusParts(): ColoredPart[] {
  const parts: ColoredPart[] = [
    { geometry: rbox(2.5, 2.6, 10, 0.3, 2), color: '#d8433b', position: [0, 1.75, 0] },
    { geometry: rbox(2.4, 0.22, 9.6, 0.1), color: TOY.WHITE, position: [0, 3.1, 0] },
    { geometry: rbox(2.52, 0.95, 8.2, 0.06), color: TOY.BLACK, position: [0, 2.3, 0.6] },
    { geometry: rbox(2.2, 1.25, 0.06, 0.05), color: TOY.GLASS, position: [0, 2.15, -5.0] },
    { geometry: rbox(1.6, 0.26, 0.05, 0.03), color: TOY.BLACK, position: [0, 2.95, -5.01] },
    { geometry: rbox(1.4, 0.08, 0.05, 0.02), color: '#ffd23f', position: [0, 2.95, -5.03] },
    // Door on the right, front.
    { geometry: rbox(0.05, 1.9, 1.0, 0.03), color: TOY.GLASS_DARK, position: [1.26, 1.45, -3.9] },
    ...headlights([-0.85, 0.85], 0.9, -5.0, 0.14),
    ...taillights([-0.95, 0.95], 1.0, 5.0, 0.22, 0.3),
    bumper(2.54, 0.48, -4.98),
    bumper(2.54, 0.48, 4.98),
    ...toyWheel(-1.15, -3.3, 0.55, 0.38),
    ...toyWheel(1.15, -3.3, 0.55, 0.38),
    ...toyWheel(-1.15, 3.3, 0.55, 0.38),
    ...toyWheel(1.15, 3.3, 0.55, 0.38),
  ];
  for (let i = 0; i < 6; i++) parts.push(...sideWindows(1.27, 2.3, [-2.9 + i * 1.45], 0.8, 1.2));
  return parts;
}

export function mixerParts(): ColoredPart[] {
  const tilt: V3 = [Math.PI / 2 - 0.2, 0, 0];
  const parts: ColoredPart[] = [
    { geometry: rbox(2.4, 0.5, 6, 0.12), color: TOY.DARK, position: [0, 0.95, 0] },
    { geometry: rbox(2.4, 1.6, 1.7, 0.3, 2), color: '#e8e8e8', position: [0, 1.95, -2.15] },
    { geometry: rbox(2.1, 0.7, 0.05, 0.04), color: TOY.GLASS, position: [0, 2.25, -3.0], rotation: [0.15, 0, 0] },
    ...sideWindows(1.21, 2.25, [-2.15], 0.6, 0.9),
    ...headlights([-0.85, 0.85], 1.45, -3.0),
    bumper(2.44, 0.75, -3.0),
    // Drum: two frustums meeting in the middle, with white bands; chute at the back.
    { geometry: cyl(0.75, 1.2, 1.9, 14), color: '#ff8a3d', position: [0, 2.15, 0.15], rotation: tilt },
    { geometry: cyl(1.2, 0.55, 1.9, 14), color: '#ff8a3d', position: [0, 2.53, 1.98], rotation: tilt },
    { geometry: cyl(1.24, 1.24, 0.22, 14), color: TOY.WHITE, position: [0, 2.34, 1.07], rotation: tilt },
    { geometry: cyl(1.0, 1.0, 0.2, 14), color: TOY.WHITE, position: [0, 2.12, 0.0], rotation: tilt },
    { geometry: rbox(0.4, 0.12, 1.0, 0.04), color: TOY.HUB, position: [0, 2.0, 3.3], rotation: [0.5, 0, 0] },
    ...taillights([-1.0, 1.0], 0.95, 3.0),
  ];
  for (const z of [-2.2, 1.6, 2.6]) parts.push(...toyWheel(-1.2, z, 0.55, 0.42), ...toyWheel(1.2, z, 0.55, 0.42));
  return parts;
}

/** Dump truck: body plus a separate bed (so a parked prop can tip it). */
export function dumpTruckParts(): { body: ColoredPart[]; bed: ColoredPart[]; pivot: V3 } {
  const body: ColoredPart[] = [
    { geometry: rbox(2.3, 0.5, 5.2, 0.12), color: TOY.DARK, position: [0, 0.95, 0] },
    { geometry: rbox(2.4, 1.6, 1.6, 0.3, 2), color: TOY.ORANGE, position: [0, 1.95, -1.8] },
    { geometry: rbox(2.1, 0.68, 0.05, 0.04), color: TOY.GLASS, position: [0, 2.25, -2.62], rotation: [0.15, 0, 0] },
    ...sideWindows(1.21, 2.25, [-1.8], 0.58, 0.9),
    { geometry: rbox(1.3, 0.42, 0.05, 0.03), color: TOY.DARK, position: [0, 1.45, -2.62] },
    ...headlights([-0.85, 0.85], 1.45, -2.62),
    { geometry: rbox(0.3, 0.12, 0.12, 0.04), color: TOY.INDICATOR, position: [-0.6, 2.82, -1.8] },
    { geometry: rbox(0.3, 0.12, 0.12, 0.04), color: TOY.INDICATOR, position: [0.6, 2.82, -1.8] },
    bumper(2.44, 0.75, -2.62),
    ...taillights([-0.95, 0.95], 0.95, 2.62),
    ...toyWheel(-1.2, -1.8, 0.55, 0.45),
    ...toyWheel(1.2, -1.8, 0.55, 0.45),
    ...toyWheel(-1.2, 1.6, 0.55, 0.45),
    ...toyWheel(1.2, 1.6, 0.55, 0.45),
  ];
  const bed: ColoredPart[] = [
    { geometry: rbox(2.6, 1.3, 3.2, 0.14, 2), color: TOY.YELLOW, position: [0, 1.85, 0.9] },
    { geometry: rbox(2.64, 0.12, 3.24, 0.05), color: '#e0a800', position: [0, 2.48, 0.9] },
    // Ribs on the sides.
    { geometry: rbox(2.66, 1.0, 0.12, 0.04), color: '#e0a800', position: [0, 1.85, 0.1] },
    { geometry: rbox(2.66, 1.0, 0.12, 0.04), color: '#e0a800', position: [0, 1.85, 1.7] },
    // Lumpy load.
    { geometry: ico(0.75, 1), color: '#9a8466', position: [-0.5, 2.55, 0.6], scale: [1.2, 0.5, 1.2] },
    { geometry: ico(0.7, 1), color: '#8a7658', position: [0.55, 2.55, 1.25], scale: [1.2, 0.5, 1.1] },
  ];
  return { body, bed, pivot: [0, 1.2, 2.5] };
}

export function tractorParts(): ColoredPart[] {
  const GREEN = '#3a9a3e';
  return [
    // Rounded hood with a grille and lights.
    { geometry: rbox(1.25, 0.95, 2.4, 0.28, 2), color: GREEN, position: [0, 1.25, -0.6] },
    { geometry: rbox(0.9, 0.62, 0.05, 0.03), color: TOY.DARK, position: [0, 1.22, -1.81] },
    ...headlights([-0.42, 0.42], 1.62, -1.75, 0.1),
    // Cab: glass with a roof on four posts.
    { geometry: rbox(1.4, 1.2, 1.3, 0.12, 2), color: TOY.GLASS_DARK, position: [0, 2.15, 0.85] },
    { geometry: rbox(1.6, 0.14, 1.55, 0.06), color: '#2f7f33', position: [0, 2.82, 0.85] },
    { geometry: rbox(1.5, 0.55, 1.4, 0.1), color: GREEN, position: [0, 1.5, 0.85] },
    // Exhaust with a cap.
    { geometry: cyl(0.07, 0.07, 1.1, 6), color: TOY.DARK, position: [0.42, 2.15, -1.2] },
    { geometry: cyl(0.1, 0.1, 0.08, 6), color: TOY.DARK, position: [0.42, 2.72, -1.2] },
    // Big rear wheels with yellow rims, small front ones.
    ...toyWheel(-0.98, 0.9, 0.95, 0.5, TOY.YELLOW),
    ...toyWheel(0.98, 0.9, 0.95, 0.5, TOY.YELLOW),
    ...toyWheel(-0.8, -1.3, 0.5, 0.35, TOY.YELLOW),
    ...toyWheel(0.8, -1.3, 0.5, 0.35, TOY.YELLOW),
    // Mudguards over the rear wheels.
    { geometry: rbox(0.55, 0.12, 1.5, 0.05), color: GREEN, position: [-0.98, 1.95, 0.9] },
    { geometry: rbox(0.55, 0.12, 1.5, 0.05), color: GREEN, position: [0.98, 1.95, 0.9] },
  ];
}
