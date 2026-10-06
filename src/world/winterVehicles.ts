import { box, dome, rbox, type ColoredPart } from './geometry';
import { pickupParts } from './toyParts';

export function snowplowParts(): ColoredPart[] {
  return [
    ...pickupParts('#f6a53b'),
    { geometry: rbox(2.9, 0.85, 0.28, 0.08), color: '#e57c35', position: [0, 0.58, -3.05], rotation: [0, 0.12, -0.03] },
    { geometry: box(2.9, 0.12, 0.3), color: '#536473', position: [0, 0.19, -3.06], rotation: [0, 0.12, -0.03] },
    { geometry: box(0.12, 0.18, 0.75), color: '#536473', position: [-0.55, 0.55, -2.7] },
    { geometry: box(0.12, 0.18, 0.75), color: '#536473', position: [0.55, 0.55, -2.7] },
    { geometry: dome(0.16), color: '#ffd85a', position: [0, 2.03, -0.6] },
    { geometry: rbox(1.5, 0.7, 1.7), color: '#818d98', position: [0, 1.6, 1.3] },
  ];
}

export function skiPickupParts(color: string): ColoredPart[] {
  const parts = pickupParts(color);
  for (const z of [-1.1, 0]) parts.push({ geometry: box(1.8, 0.1, 0.15), color: '#435368', position: [0, 2.05, z] });
  for (const [i, x] of [-0.33, 0.33].entries()) {
    parts.push({ geometry: rbox(0.15, 0.065, 3.1), color: i ? '#ffe16f' : '#e76056', position: [x, 2.16, -0.6] });
    parts.push({ geometry: rbox(0.15, 0.065, 0.45), color: i ? '#ffe16f' : '#e76056',
      position: [x, 2.24, -2.2], rotation: [0.4, 0, 0] });
    parts.push({ geometry: box(0.16, 0.1, 0.18), color: '#334659', position: [x, 2.23, -0.6] });
  }
  return parts;
}
