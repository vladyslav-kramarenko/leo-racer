import type { WorldPreset } from './types';

export const city: WorldPreset = {
  id: 'city',
  name: 'City',
  thumbnail: '/worlds/city.jpg',
  sky: {
    top: '#6ab4f2',
    horizon: '#e6f1fa',
    fogColor: '#dfe9f2',
    fogNear: 60,
    fogFar: 220,
    sunColor: '#fff5e2',
    sunIntensity: 2.2,
    hemiSky: '#d9ebfa',
    hemiGround: '#9a9a90',
    hemiIntensity: 1.35,
    hills: { colors: ['#9fb7c9', '#8ea8bc', '#b2c6d4'], height: [18, 42], width: [16, 30] },
  },
  terrain: {
    base: '#9cc46e',
    speckles: ['#90b862', '#a8cd7a', '#86ad5a'],
    patches: ['#b0d483', '#8ab05e', '#c2dc96'],
    bands: [{ side: 'both', from: 6.5, to: 10.5, color: '#cfd1d4', y: 0.05 }],
  },
  road: {
    asphalt: '#4e525a',
    asphaltSpeckle: '#585c64',
    edgeLine: '#ffffff',
    centerLine: '#ffffff',
    shoulder: '#5b5f67',
    curve: [
      { amplitude: 10, wavelength: 640, phase: 0.2 },
      { amplitude: 4, wavelength: 260, phase: 1.7 },
    ],
  },
  props: {
    perChunk: [4, 7],
    shoulderCones: 2,
    shoulderProp: 'streetLamp',
    shoulderDistance: 0.6,
    items: [
      { kind: 'house', weight: 3, minDistance: 6, maxDistance: 14, scale: [0.9, 1.15], maxPerChunk: 3, facing: 'road' },
      { kind: 'building', weight: 2.5, minDistance: 8, maxDistance: 20, scale: [0.9, 1.2], maxPerChunk: 2, facing: 'road' },
      { kind: 'shop', weight: 2, minDistance: 5, maxDistance: 9, scale: [1, 1.1], maxPerChunk: 2, facing: 'road' },
      { kind: 'parkedCar', weight: 3, minDistance: -1.0, maxDistance: -0.9, scale: [1, 1], maxPerChunk: 2, facing: 'road' },
      { kind: 'trafficLight', weight: 1, minDistance: 0.4, maxDistance: 0.8, scale: [1, 1], maxPerChunk: 1, facing: 'traffic' },
      { kind: 'roundTree', weight: 2, minDistance: 2.5, maxDistance: 5, scale: [0.8, 1.1], maxPerChunk: 3 },
      { kind: 'bush', weight: 1, minDistance: 2, maxDistance: 5, scale: [0.8, 1.1], maxPerChunk: 2 },
    ],
  },
  traffic: { enabled: true, vehicles: ['car', 'car', 'cityBus', 'van', 'pickup'] },
  audio: {
    engineBaseHz: 54,
    ambience: { noiseLevel: 0.06, noiseCutoff: 450, events: ['honk', 'bell', 'chirp'], eventInterval: [4, 10] },
  },
};
