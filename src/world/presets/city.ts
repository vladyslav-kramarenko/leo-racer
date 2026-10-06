import type { WorldPreset } from './types';

/**
 * Vancouver-inspired city (simplified, not geographically exact): glass towers on podiums,
 * a seawall along False Creek on the left, snowy North Shore mountains, cherry blossoms,
 * a SkyTrain-style elevated line with trains, and now and then a landmark — a geodesic
 * science dome, a pier with white sails, a lookout tower and a little steam clock.
 * Night palette, window lights and pooled street lighting keep the road readable.
 */
export const city: WorldPreset = {
  id: 'city',
  name: 'City',
  thumbnail: '/worlds/city.jpg',
  sky: {
    top: '#090f2c',
    horizon: '#263958',
    fogColor: '#22324d',
    fogNear: 70,
    fogFar: 235,
    sunColor: '#a4bdff',
    sunIntensity: 0.55,
    hemiSky: '#7c94cb',
    hemiGround: '#444665',
    hemiIntensity: 0.8,
    night: { stars: 180, moonColor: '#fff0c6', lampColor: '#ffd38a',
      windowColors: ['#ffd486', '#ffe8b4', '#8ed7ed'] },
    hills: {
      colors: ['#253651', '#2c405a', '#203149', '#354a64'],
      height: [28, 52],
      width: [42, 72],
      snowCap: '#8096b8',
    },
    // Downtown skyline on the right; across False Creek (left) you see the mountains.
    skyline: {
      colors: ['#273952', '#314360', '#23344c', '#3b4b68', '#2d3e59'],
      height: [24, 62],
      width: [8, 15],
      count: 64,
      side: 'right',
    },
  },
  terrain: {
    base: '#415a53',
    speckles: ['#3b514e', '#4c635a', '#354a48'],
    patches: ['#53695c', '#3c514e', '#5e7162'],
    bands: [
      // Sidewalks on both sides.
      { side: 'both', from: 6.5, to: 10.5, color: '#7d899b', y: 0.05 },
      // Seawall promenade and False Creek on the left.
      { side: 'left', from: 10.5, to: 14, color: '#8993a3', y: 0.05 },
      { side: 'left', from: 14, to: 330, color: '#183956', y: 0.04 },
      { side: 'left', from: 14, to: 14.6, color: '#52657a', y: 0.09 },
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
    shoulderCones: 3,
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
      colors: { body: '#f2f4f6', stripe: '#1f6fd0', window: '#4c6275' },
      windowGlow: true,
    },
  },
  audio: {
    engineBaseHz: 54,
    ambience: { noiseLevel: 0.06, noiseCutoff: 450, events: ['gull', 'honk', 'bell'], eventInterval: [6, 13] },
  },
};
