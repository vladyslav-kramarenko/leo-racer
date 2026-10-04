import type { WorldPreset } from './types';

/**
 * Vancouver-inspired city (simplified, not geographically exact): glass towers on podiums,
 * a seawall along False Creek on the left, snowy North Shore mountains, cherry blossoms,
 * a SkyTrain-style elevated line with trains, and now and then a landmark — a geodesic
 * science dome, a pier with white sails, a lookout tower and a little steam clock.
 */
export const city: WorldPreset = {
  id: 'city',
  name: 'City',
  thumbnail: '/worlds/city.jpg',
  sky: {
    top: '#6aaee8',
    horizon: '#e4eef6',
    fogColor: '#dde7ef',
    fogNear: 60,
    fogFar: 225,
    sunColor: '#fff3e0',
    sunIntensity: 2.1,
    hemiSky: '#d8e8f6',
    hemiGround: '#8c9a8c',
    hemiIntensity: 1.35,
    hills: {
      colors: ['#5f7d8f', '#6c8a9b', '#55717f', '#7896a6'],
      height: [42, 74],
      width: [42, 72],
      snowCap: '#f4f8fb',
    },
    // Downtown skyline on the right; across False Creek (left) you see the mountains.
    skyline: {
      colors: ['#b9cfdf', '#c9d9e6', '#aac3d6', '#d3e0ea', '#b3cbd9'],
      height: [24, 62],
      width: [8, 15],
      count: 64,
      side: 'right',
    },
  },
  terrain: {
    base: '#9cc46e',
    speckles: ['#90b862', '#a8cd7a', '#86ad5a'],
    patches: ['#b0d483', '#8ab05e', '#c2dc96'],
    bands: [
      // Sidewalks on both sides.
      { side: 'both', from: 6.5, to: 10.5, color: '#cfd1d4', y: 0.05 },
      // Seawall promenade and False Creek on the left.
      { side: 'left', from: 10.5, to: 14, color: '#ddd6c8', y: 0.05 },
      { side: 'left', from: 14, to: 330, color: '#3f86b8', y: 0.04 },
      { side: 'left', from: 14, to: 14.6, color: '#7a7f86', y: 0.09 },
    ],
  },
  road: {
    asphalt: '#4e525a',
    asphaltSpeckle: '#585c64',
    edgeLine: '#ffffff',
    centerLine: '#ffd23f',
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
      // Downtown side (right).
      { kind: 'glassTower', weight: 3, minDistance: 10, maxDistance: 18, scale: [0.85, 1.15], maxPerChunk: 2, facing: 'road', side: 'right' },
      { kind: 'building', weight: 2, minDistance: 8, maxDistance: 16, scale: [0.9, 1.1], maxPerChunk: 2, facing: 'road', side: 'right' },
      // Kept clear of the SkyTrain columns above the right sidewalk.
      { kind: 'shop', weight: 2, minDistance: 6.8, maxDistance: 9, scale: [1, 1.1], maxPerChunk: 2, facing: 'road', side: 'right' },
      { kind: 'blossomTree', weight: 3, minDistance: 2.5, maxDistance: 4.5, scale: [0.85, 1.15], maxPerChunk: 3 },
      { kind: 'parkedCar', weight: 2.5, minDistance: -1.0, maxDistance: -0.9, scale: [1, 1], maxPerChunk: 2, facing: 'traffic' },
      { kind: 'trafficLight', weight: 1, minDistance: 0.4, maxDistance: 0.8, scale: [1, 1], maxPerChunk: 1, facing: 'traffic' },
      // Boats on False Creek (left).
      { kind: 'sailboat', weight: 1.2, minDistance: 20, maxDistance: 60, scale: [1, 1.4], maxPerChunk: 1, side: 'left' },
      // Landmarks, one at a time.
      { kind: 'scienceWorld', weight: 1, minDistance: 17, maxDistance: 20, scale: [1, 1], maxPerChunk: 1, side: 'left', every: { chunks: 12, offset: 2 } },
      { kind: 'canadaPlace', weight: 1, minDistance: 13, maxDistance: 15, scale: [1, 1], maxPerChunk: 1, facing: 'road', side: 'left', every: { chunks: 12, offset: 8 } },
      { kind: 'harbourCentre', weight: 1, minDistance: 22, maxDistance: 28, scale: [1, 1], maxPerChunk: 1, facing: 'road', side: 'right', every: { chunks: 9, offset: 5 } },
      { kind: 'steamClock', weight: 1, minDistance: 1.2, maxDistance: 1.6, scale: [1, 1], maxPerChunk: 1, facing: 'traffic', side: 'right', every: { chunks: 7, offset: 1 } },
    ],
  },
  // In town the sports car behaves: it just drives along with everyone else.
  traffic: { enabled: true, vehicles: ['car', 'car', 'cityBus', 'van', 'pickup', 'car', 'sportsCar', 'police'] },
  // SkyTrain-style elevated line above the right sidewalk.
  guideway: {
    side: 'right',
    offset: 9,
    height: 7.4,
    width: 3.2,
    thickness: 1.1,
    color: '#cfccc5',
    columnSpacing: 20,
    train: {
      cars: 4,
      carLength: 8.4,
      speed: 13,
      intervalSec: [12, 22],
      colors: { body: '#f2f4f6', stripe: '#1f6fd0', window: '#2b3a4a' },
    },
  },
  audio: {
    engineBaseHz: 54,
    ambience: { noiseLevel: 0.06, noiseCutoff: 450, events: ['gull', 'honk', 'bell', 'gull'], eventInterval: [3.5, 9] },
  },
};
