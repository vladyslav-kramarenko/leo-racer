import type { WorldPreset } from './types';

/** A bright, Whistler-inspired ski village: cleared road, snowy forest and moving winter scenes. */
export const winter: WorldPreset = {
  id: 'winter', name: 'Winter', thumbnail: '/worlds/winter.jpg',
  sky: {
    top: '#8cbae4', horizon: '#edf4fb', fogColor: '#e1edf7', fogNear: 90, fogFar: 260,
    sunColor: '#fff3dc', sunIntensity: 1.9, hemiSky: '#e8f4ff', hemiGround: '#98adc3', hemiIntensity: 1.65,
    hills: { colors: ['#95adc5', '#a8bed0', '#7d99b5'], height: [52, 90], width: [38, 65], snowCap: '#fffdf7' },
  },
  terrain: { base: '#eef4f8', speckles: ['#e5edf4', '#f9fbff'], patches: ['#d9e7f1', '#ffffff', '#e7eff6'] },
  road: {
    asphalt: '#63717e', asphaltSpeckle: '#75818c', edgeLine: '#ffffff', centerLine: '#ffe076', shoulder: '#d0e0ed',
    curve: [{ amplitude: 12, wavelength: 720, phase: 0.1 }, { amplitude: 3, wavelength: 370, phase: 0.5 }],
  },
  props: {
    perChunk: [13, 19], shoulderCones: 0,
    items: [
      { kind: 'snowPine', weight: 12, minDistance: 4, maxDistance: 42, scale: [1, 1.8], maxPerChunk: 12 },
      { kind: 'snowbank', weight: 4, minDistance: 2, maxDistance: 5, scale: [0.8, 1.4], maxPerChunk: 4 },
      { kind: 'chalet', weight: 3, minDistance: 8, maxDistance: 23, scale: [0.85, 1.1], maxPerChunk: 3, facing: 'road' },
      { kind: 'snowman', weight: 2, minDistance: 2, maxDistance: 6, scale: [0.9, 1.2], maxPerChunk: 3, facing: 'road' },
      { kind: 'snowFort', weight: 1, minDistance: 5, maxDistance: 9, scale: [0.8, 1], maxPerChunk: 2, facing: 'road' },
      { kind: 'fox', weight: 2, minDistance: 2, maxDistance: 7, scale: [1.1, 1.4], maxPerChunk: 2, facing: 'road' },
      { kind: 'hare', weight: 2, minDistance: 1.5, maxDistance: 5, scale: [1.1, 1.5], maxPerChunk: 3, facing: 'road' },
      { kind: 'skiSlope', weight: 1, minDistance: 20, maxDistance: 22, scale: [1, 1], maxPerChunk: 1,
        side: 'right', facing: 'traffic', every: { chunks: 10, offset: 1 } },
      { kind: 'iceRink', weight: 1, minDistance: 12, maxDistance: 14, scale: [1, 1], maxPerChunk: 1,
        side: 'left', facing: 'road', every: { chunks: 10, offset: 4 } },
      { kind: 'sledHill', weight: 1, minDistance: 10, maxDistance: 12, scale: [1, 1], maxPerChunk: 1,
        side: 'right', facing: 'traffic', every: { chunks: 10, offset: 7 } },
    ],
  },
  snowfall: { count: 240, speed: 1.5 },
  santaSleigh: { altitude: 34, intervalSec: [25, 40] },
  traffic: { enabled: true, vehicles: ['snowplow', 'skiPickup', 'car', 'van'] },
  audio: { engineBaseHz: 48, ambience: { noiseLevel: 0.025, noiseCutoff: 420, events: ['chirp'], eventInterval: [7, 13] } },
};
