import { box, buildColoredGeometry, cyl, ico, rbox, type ColoredPart } from './geometry';
import type { PropModel } from './props';

/** A roadside quarry floor, stepped rock face and a purpose-built giant haul truck. */
export function quarry(): PropModel {
  const parts: ColoredPart[] = [];
  const addBox = (w: number, h: number, d: number, color: string, x: number, y: number, z: number) => {
    parts.push({ geometry: rbox(w, h, d, 0.2), color, position: [x, y, z] });
  };
  parts.push({ geometry: box(64, 0.12, 46), color: '#c8a475', position: [0, 0.08, 15] });
  // The road runs along the open side; each shelf rises farther into the hillside.
  for (let tier = 0; tier < 4; tier++) {
    const height = 3 + tier * 3;
    for (let section = 0; section < 8; section++) {
      addBox(8.2, height, 7, ['#b68c60', '#d2ab7a', '#a67e59', '#ddbc8b'][tier],
        -28 + section * 8, height / 2, 17 + tier * 6);
    }
  }
  for (let i = 0; i < 15; i++) {
    parts.push({ geometry: ico(1.6 + (i % 3) * 0.5), color: i % 2 ? '#9e8d79' : '#c3b4a0',
      position: [15 + (i % 5) * 2.6, 1, 2 + Math.floor(i / 5) * 3], scale: [1, 0.7, 1] });
  }
  // Truck front is -Z, facing the passing driver. Overall height ~8 m.
  addBox(8, 1, 12, '#34383e', -5, 2.6, 2);
  for (const x of [-9, -1]) {
    for (const z of [-2, 5]) {
      parts.push({ geometry: cyl(1.8, 1.8, 1.3, 16), color: '#25282c', position: [x, 1.8, z], rotation: [0, 0, Math.PI / 2] });
      parts.push({ geometry: cyl(0.9, 0.9, 1.35, 12), color: '#ffbf24', position: [x, 1.8, z], rotation: [0, 0, Math.PI / 2] });
    }
  }
  addBox(8.6, 0.7, 8.5, '#e7a51a', -5, 4.2, 4);
  addBox(0.6, 2.7, 8.5, '#ffc72d', -9, 5.6, 4);
  addBox(0.6, 2.7, 8.5, '#ffc72d', -1, 5.6, 4);
  addBox(8.6, 2.7, 0.6, '#f2b51e', -5, 5.6, 8);
  addBox(8.6, 3.5, 0.7, '#ffd449', -5, 5.9, 0);
  for (let i = 0; i < 9; i++) {
    parts.push({ geometry: ico(1.15), color: i % 2 ? '#9e968b' : '#b9b0a0',
      position: [-7.5 + (i % 3) * 2.4, 5.5 + (i % 2) * 0.5, 2 + Math.floor(i / 3) * 2] });
  }
  addBox(3.4, 3.1, 3.4, '#ffc72d', -7, 5.1, -3);
  addBox(2.9, 1.5, 0.12, '#80cce7', -7, 5.5, -4.76);
  addBox(0.12, 1.5, 2.7, '#80cce7', -8.76, 5.5, -3);
  addBox(3.9, 0.35, 4, '#ffe069', -7, 6.85, -3);
  addBox(4, 1.8, 3, '#efb120', -3, 4.1, -3);
  addBox(3.1, 1.1, 0.15, '#34383e', -3, 4.1, -4.55);
  addBox(8.5, 0.5, 0.7, '#d7dce1', -5, 2.9, -5);
  for (const x of [-8.5, -1.5]) addBox(0.8, 0.5, 0.15, '#fff5c1', x, 3.5, -4.6);
  // Access ladder makes the oversized cab easy to read at a glance.
  for (const x of [-8.1, -6.5]) addBox(0.12, 3.2, 0.15, '#e9edf0', x, 2.8, -4.85);
  for (let i = 0; i < 6; i++) addBox(1.7, 0.12, 0.2, '#e9edf0', -7.3, 1.4 + i * 0.5, -4.9);
  return { body: buildColoredGeometry(parts) };
}
