import type { WorldPreset } from './types';

/** A Banff-inspired forest road with wildlife overpasses in the Canadian Rockies. */
export const nature: WorldPreset = {
  id: 'nature',
  name: 'Nature',
  thumbnail: '/worlds/nature-forest.jpg',
  sky: {
    top: '#579bdb', horizon: '#e2edf3', fogColor: '#d7e5e8', fogNear: 75, fogFar: 240,
    sunColor: '#fff1d5', sunIntensity: 2, hemiSky: '#d8eaff', hemiGround: '#45653c', hemiIntensity: 1.45,
    hills: { colors: ['#6b7d80', '#819496', '#596f77', '#9ba7a6'], height: [48, 86], width: [35, 62], snowCap: '#faf9f4' },
  },
  terrain: { base: '#729654', speckles: ['#648748', '#8baa66', '#55753f'], patches: ['#a3b97b', '#597e43', '#839b59'] },
  road: {
    asphalt: '#565c62', asphaltSpeckle: '#656d70', edgeLine: '#ffffff', centerLine: '#ffd24a', shoulder: '#b0a28a',
    curve: [{ amplitude: 13, wavelength: 650, phase: 0.2 }, { amplitude: 4, wavelength: 310, phase: 0.7 }],
  },
  props: {
    perChunk: [14, 20], shoulderCones: 0,
    items: [
      { kind: 'pine', weight: 12, minDistance: 3.5, maxDistance: 38, scale: [1.2, 2.1], maxPerChunk: 12 },
      { kind: 'roundTree', weight: 3, minDistance: 6, maxDistance: 28, scale: [0.9, 1.5], maxPerChunk: 3 },
      { kind: 'rock', weight: 2, minDistance: 2, maxDistance: 15, scale: [0.7, 1.6], maxPerChunk: 3 },
      { kind: 'bush', weight: 3, minDistance: 1.2, maxDistance: 20, scale: [0.7, 1.2], maxPerChunk: 4 },
      { kind: 'flowers', weight: 1, minDistance: 1, maxDistance: 5, scale: [0.9, 1.2], maxPerChunk: 2 },
      { kind: 'elk', weight: 3, minDistance: 3, maxDistance: 8, scale: [1, 1.2], maxPerChunk: 3, facing: 'road' },
      { kind: 'moose', weight: 1, minDistance: 5, maxDistance: 10, scale: [1, 1.1], maxPerChunk: 1, facing: 'road' },
      { kind: 'bear', weight: 1.5, minDistance: 4, maxDistance: 10, scale: [1, 1.2], maxPerChunk: 2, facing: 'road' },
      { kind: 'bighorn', weight: 2, minDistance: 2.5, maxDistance: 7, scale: [1, 1.15], maxPerChunk: 2, facing: 'road' },
      { kind: 'wolf', weight: 1, minDistance: 4, maxDistance: 9, scale: [1, 1.1], maxPerChunk: 2, facing: 'road' },
      { kind: 'elk', weight: 1, minDistance: 3.5, maxDistance: 4.5, scale: [1, 1], maxPerChunk: 3, facing: 'road', every: { chunks: 4, offset: 0 } },
      { kind: 'wildlifeBridge', weight: 1, minDistance: 0, maxDistance: 0, scale: [1, 1], maxPerChunk: 1,
        facing: 'traffic', roadCentered: true, every: { chunks: 8, offset: 2 } },
    ],
  },
  traffic: { enabled: true, vehicles: ['car', 'camper', 'van', 'pickup'] },
  audio: { engineBaseHz: 50, ambience: { noiseLevel: 0.035, noiseCutoff: 550, events: ['chirp'], eventInterval: [3, 7] } },
};
