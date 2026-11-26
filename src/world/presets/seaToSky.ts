import type { WorldPreset } from './types';

/** Coastal mountain road: sea on the left, forest and snowy mountains on the right. */
export const seaToSky: WorldPreset = {
  id: 'sea-to-sky',
  name: 'Sea to Sky',
  thumbnail: '/worlds/nature.jpg',
  sky: {
    top: '#4f9fe8',
    horizon: '#dcefff',
    fogColor: '#d3e7f5',
    fogNear: 70,
    fogFar: 230,
    sunColor: '#fff6e0',
    sunIntensity: 2.1,
    hemiSky: '#d4ecff',
    hemiGround: '#5d7a45',
    hemiIntensity: 1.35,
    hills: {
      colors: ['#5c7f63', '#6b8f6a', '#4f7058', '#7a9a83'],
      height: [34, 66],
      width: [40, 70],
      snowCap: '#f4f8fb',
    },
  },
  terrain: {
    base: '#7fb35a',
    speckles: ['#72a650', '#8cc064', '#6a9a49'],
    patches: ['#93c76c', '#6e9e4c', '#a8cf7a'],
    bands: [
      { side: 'left', from: 8.5, to: 15, color: '#e8d6a8', y: 0.04 },
      { side: 'left', from: 15, to: 330, color: '#3f8fc4', y: 0.04 },
      { side: 'left', from: 15, to: 17, color: '#7fc4e6', y: 0.09 },
    ],
  },
  road: {
    asphalt: '#575b63',
    asphaltSpeckle: '#62666e',
    edgeLine: '#ffffff',
    centerLine: '#ffd23f',
    shoulder: '#a49a86',
    curve: [
      { amplitude: 18, wavelength: 620, phase: 0.6 },
      { amplitude: 6, wavelength: 210, phase: 2.1 },
    ],
  },
  props: {
    perChunk: [5, 9],
    shoulderCones: 0,
    items: [
      { kind: 'pine', weight: 6, minDistance: 11, maxDistance: 30, scale: [0.8, 1.5], maxPerChunk: 6, side: 'right' },
      { kind: 'roundTree', weight: 2, minDistance: 11, maxDistance: 25, scale: [0.8, 1.3], maxPerChunk: 2, side: 'right' },
      { kind: 'rock', weight: 3, minDistance: 0.5, maxDistance: 1.5, scale: [0.6, 1.3], maxPerChunk: 3 },
      { kind: 'bush', weight: 2, minDistance: 0.8, maxDistance: 3, scale: [0.8, 1.3], maxPerChunk: 3, side: 'right' },
      { kind: 'flowers', weight: 2, minDistance: 0.6, maxDistance: 3, scale: [0.9, 1.3], maxPerChunk: 3, side: 'right' },
      { kind: 'log', weight: 1, minDistance: 1.5, maxDistance: 2.5, scale: [0.9, 1.2], maxPerChunk: 1, side: 'right' },
      { kind: 'viewpoint', weight: 0.6, minDistance: 0.8, maxDistance: 1.4, scale: [1, 1], maxPerChunk: 1, facing: 'traffic', side: 'left' },
      { kind: 'sailboat', weight: 1.2, minDistance: 25, maxDistance: 70, scale: [1, 1.4], maxPerChunk: 1, side: 'left' },
      // Now and then: a mountain with a gondola, set back behind the forest.
      { kind: 'gondola', weight: 1, minDistance: 30, maxDistance: 34, scale: [1, 1], maxPerChunk: 1, facing: 'road', side: 'right', every: { chunks: 13, offset: 4 } },
    ],
  },
  // Sea to Sky highway: campers, the odd sports car zooming past, an RCMP-style patrol.
  freightRailway: { offset: 12, wagons: 5, speed: 20, intervalSec: [14, 24] },
  traffic: {
    enabled: true,
    vehicles: ['car', 'camper', 'pickup', 'van', 'car', 'camper', 'sportsCar', 'police'],
    overtaking: ['sportsCar'],
  },
  audio: {
    engineBaseHz: 50,
    ambience: { noiseLevel: 0.06, noiseCutoff: 520, noiseSwellHz: 0.12, events: ['wave'], eventInterval: [5, 10] },
  },
};
