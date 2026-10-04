import type { WorldPreset } from './types';

export const farm: WorldPreset = {
  id: 'farm',
  name: 'Farm',
  thumbnail: '/worlds/farm.jpg',
  sky: {
    top: '#62b6ff',
    horizon: '#e4f4ff',
    fogColor: '#dff0fb',
    fogNear: 75,
    fogFar: 235,
    sunColor: '#fff3d6',
    sunIntensity: 2.3,
    hemiSky: '#d6eeff',
    hemiGround: '#8aa357',
    hemiIntensity: 1.3,
    hills: { colors: ['#a7d36e', '#8fc35d', '#bde084'], height: [10, 26], width: [34, 60] },
  },
  terrain: {
    base: '#8cc65a',
    speckles: ['#7fb950', '#99cf66', '#76ad4a'],
    patches: ['#a3d670', '#7cb64c', '#b3db7e'],
    bands: [
      { side: 'right', from: 10, to: 26, color: '#e8c95a', y: 0.03 },
      { side: 'right', from: 26, to: 40, color: '#7cb34d', y: 0.03 },
      { side: 'right', from: 40, to: 62, color: '#a07850', y: 0.03 },
      { side: 'left', from: 10, to: 30, color: '#6faa45', y: 0.03 },
      { side: 'left', from: 30, to: 52, color: '#f0d46a', y: 0.03 },
    ],
  },
  road: {
    // Country dirt road: no painted lines.
    asphalt: '#a58a64',
    asphaltSpeckle: '#b39a74',
    edgeLine: null,
    centerLine: null,
    shoulder: '#86b456',
    curve: [
      { amplitude: 14, wavelength: 520, phase: 1.1 },
      { amplitude: 6, wavelength: 190, phase: 0.4 },
    ],
  },
  props: {
    perChunk: [3, 6],
    shoulderCones: 4,
    shoulderProp: 'fence',
    shoulderDistance: 0.9,
    items: [
      { kind: 'barn', weight: 1.2, minDistance: 14, maxDistance: 26, scale: [1, 1.1], maxPerChunk: 1, facing: 'road' },
      { kind: 'silo', weight: 1, minDistance: 16, maxDistance: 30, scale: [0.9, 1.1], maxPerChunk: 1 },
      { kind: 'hayBale', weight: 3, minDistance: 4, maxDistance: 22, scale: [0.9, 1.2], maxPerChunk: 4 },
      { kind: 'cow', weight: 3, minDistance: 4, maxDistance: 20, scale: [0.9, 1.1], maxPerChunk: 3 },
      { kind: 'sheep', weight: 2, minDistance: 3, maxDistance: 16, scale: [0.9, 1.1], maxPerChunk: 3 },
      { kind: 'windmill', weight: 0.8, minDistance: 18, maxDistance: 34, scale: [1, 1.2], maxPerChunk: 1, facing: 'traffic' },
      { kind: 'tractor', weight: 1, minDistance: 5, maxDistance: 18, scale: [1, 1], maxPerChunk: 1 },
      { kind: 'roundTree', weight: 1.5, minDistance: 4, maxDistance: 30, scale: [0.9, 1.4], maxPerChunk: 2 },
      { kind: 'flowers', weight: 1, minDistance: 0.6, maxDistance: 3, scale: [0.9, 1.2], maxPerChunk: 2 },
    ],
  },
  traffic: { enabled: true, vehicles: ['tractor', 'pickup', 'car', 'van'] },
  audio: {
    engineBaseHz: 50,
    ambience: { noiseLevel: 0.035, noiseCutoff: 600, events: ['chirp', 'chirp', 'moo'], eventInterval: [2.5, 7] },
  },
};
