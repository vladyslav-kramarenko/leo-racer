import type { WorldPreset } from './types';

export const construction: WorldPreset = {
  id: 'construction',
  name: 'Construction',
  sky: {
    top: '#5fb4ff',
    horizon: '#d9f0ff',
    fogColor: '#d6ecfb',
    fogNear: 70,
    fogFar: 230,
    sunColor: '#fff4dc',
    sunIntensity: 2.2,
    hemiSky: '#cfeaff',
    hemiGround: '#b98b53',
    hemiIntensity: 1.3,
    hillColors: ['#9ccf6a', '#86bf5a', '#b4d97c'],
  },
  terrain: {
    base: '#d9b273',
    speckles: ['#c99f5f', '#e6c58e', '#bf9150'],
    patches: ['#c7a064', '#e2c38a', '#b8d27a'],
  },
  road: {
    asphalt: '#5a5e66',
    asphaltSpeckle: '#666a73',
    edgeLine: '#ffffff',
    centerLine: '#ffd23f',
    shoulder: '#b8a58a',
    curve: [
      { amplitude: 16, wavelength: 560, phase: 0 },
      { amplitude: 7, wavelength: 230, phase: 1.3 },
    ],
  },
  props: {
    perChunk: [3, 6],
    shoulderCones: 4,
    items: [
      { kind: 'barrier', weight: 3, minDistance: 1.2, maxDistance: 3, scale: [1, 1], maxPerChunk: 3, facing: 'road' },
      { kind: 'concreteBlock', weight: 2, minDistance: 2, maxDistance: 10, scale: [0.9, 1.2], maxPerChunk: 3 },
      { kind: 'pipes', weight: 2, minDistance: 4, maxDistance: 14, scale: [0.9, 1.2], maxPerChunk: 2 },
      { kind: 'sign', weight: 2, minDistance: 1.3, maxDistance: 2.5, scale: [1, 1], maxPerChunk: 2, facing: 'traffic' },
      { kind: 'gravel', weight: 2, minDistance: 5, maxDistance: 18, scale: [0.8, 1.6], maxPerChunk: 2 },
      { kind: 'excavator', weight: 1.5, minDistance: 7, maxDistance: 18, scale: [1, 1.1], maxPerChunk: 1 },
      { kind: 'dumpTruck', weight: 1.5, minDistance: 7, maxDistance: 18, scale: [1, 1.1], maxPerChunk: 1 },
      { kind: 'crane', weight: 0.8, minDistance: 16, maxDistance: 30, scale: [1, 1.2], maxPerChunk: 1 },
    ],
  },
  traffic: { enabled: false },
  audio: { ambient: 'construction', engineBaseHz: 52 },
};
