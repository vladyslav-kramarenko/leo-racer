import { box, buildColoredGeometry, cyl, ico, rbox, type ColoredPart } from './geometry';
import type { NightPreset, PropKind } from './presets/types';

/** Separate unlit surfaces: buildings keep their shaded bodies and their toy colours. */
export function nightPropGeometry(kind: PropKind, cfg: NightPreset) {
  const parts: ColoredPart[] = [];
  const window = (x: number, y: number, z: number, w: number, h: number, side = false, n = 0) => {
    parts.push({ geometry: box(w, h, 0.045), color: cfg.windowColors[n % cfg.windowColors.length],
      position: [x, y, z], rotation: [0, side ? Math.PI / 2 : 0, 0] });
  };
  if (kind === 'building') {
    for (let floor = 1; floor < 4; floor++) for (let col = 0; col < 3; col++) {
      if ((floor + col) % 4 === 0) continue;
      for (const side of [-1, 1]) {
        window(-2.6 + col * 2.6, 1.2 + floor * 2.6, side * 3.59, 1.38, 1.28, false, floor + col);
        window(side * 4.025, 1.2 + floor * 2.6, -2.1 + col * 2.1, 1.2, 1.28, true, floor + col);
      }
    }
  } else if (kind === 'glassTower') {
    for (let row = 0; row < 10; row++) for (let col = 0; col < 3; col++) {
      if ((row * 3 + col) % 5 === 0) continue;
      for (const side of [-1, 1]) {
        window(-1.2 + col * 2, 7.4 + row * 3, 0.5 + side * 3.03, 1.4, 1.05, false, row + col);
        window(0.8 + side * 3.03, 7.4 + row * 3, -1.5 + col * 2, 1.4, 1.05, true, row + col + 1);
      }
    }
    window(0, 1.8, -4.59, 8.8, 2.8);
  } else if (kind === 'shop') {
    window(-0.6, 1.4, -2.59, 4.05, 1.65);
    window(2.2, 1.4, -2.59, 0.7, 1.8, false, 1);
    parts.push({ geometry: rbox(3.25, 0.1, 0.06), color: '#73e8d4', position: [-0.6, 3.53, -2.66] },
      { geometry: rbox(3.25, 0.1, 0.06), color: '#f799bd', position: [-0.6, 2.97, -2.66] });
  } else if (kind === 'streetLamp') {
    parts.push({ geometry: rbox(0.34, 0.075, 0.54), color: cfg.lampColor, position: [0, 4.39, -1.2] },
      { geometry: ico(0.16, 1), color: '#fff0c6', position: [0, 4.32, -1.2], scale: [1, 0.6, 1] });
  } else if (kind === 'scienceWorld') {
    for (let row = 0; row < 5; row++) {
      const latitude = (row / 4 - 0.5) * 1.9;
      for (let col = 0; col < 16; col++) {
        const angle = col / 16 * Math.PI * 2 + row * 0.15;
        parts.push({ geometry: ico(0.22), color: cfg.windowColors[(row + col) % cfg.windowColors.length],
          position: [Math.cos(latitude) * Math.cos(angle) * 8.03, 13.6 + Math.sin(latitude) * 8.03,
            Math.cos(latitude) * Math.sin(angle) * 8.03] });
      }
    }
    parts.push({ geometry: cyl(5.68, 5.68, 0.12, 24), color: '#6cd5ef', position: [0, 6.44, 0] });
  } else if (kind === 'canadaPlace') {
    window(0, 2, -5.09, 23.3, 1.18);
    for (let i = 0; i < 5; i++) parts.push({ geometry: ico(0.15), color: cfg.lampColor,
      position: [-9 + i * 4.5, i % 2 ? 9.6 : 10.8, 0.4] });
  } else if (kind === 'harbourCentre') {
    parts.push({ geometry: cyl(6.63, 6.63, 0.85, 24), color: '#ffe0a1', position: [0, 46.6, 0] },
      { geometry: cyl(6.52, 6.52, 0.15, 24), color: '#82d2ed', position: [0, 47.65, 0] });
  } else if (kind === 'steamClock') {
    for (const side of [-1, 1]) {
      parts.push({ geometry: cyl(0.35, 0.35, 0.015, 14), color: '#ffe1a0', position: [0, 3.55, side * 0.625], rotation: [Math.PI / 2, 0, 0] },
        { geometry: cyl(0.35, 0.35, 0.015, 14), color: '#ffe1a0', position: [side * 0.625, 3.55, 0], rotation: [0, 0, Math.PI / 2] });
    }
  }
  return parts.length ? buildColoredGeometry(parts) : null;
}
