/**
 * A world preset is pure data. Adding City / Farm / Nature means adding a new preset
 * (and optionally new prop kinds to the prop library) — the engine does not change.
 */

export type PropKind =
  | 'cone'
  | 'barrier'
  | 'concreteBlock'
  | 'pipes'
  | 'sign'
  | 'excavator'
  | 'dumpTruck'
  | 'crane'
  | 'gravel';

export interface PropSpec {
  kind: PropKind;
  /** Relative probability of being picked. */
  weight: number;
  /** Distance from the road edge, metres. */
  minDistance: number;
  maxDistance: number;
  scale: [number, number];
  maxPerChunk: number;
  /** 'road' = side-on to the road, 'traffic' = facing the approaching bus, default random. */
  facing?: 'road' | 'traffic' | 'random';
}

export interface SkyPreset {
  top: string;
  horizon: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  hillColors: string[];
}

export interface TerrainPreset {
  base: string;
  speckles: string[];
  patches: string[];
}

export interface RoadCurve {
  amplitude: number;
  wavelength: number;
  phase: number;
}

export interface RoadPreset {
  asphalt: string;
  asphaltSpeckle: string;
  edgeLine: string;
  centerLine: string;
  shoulder: string;
  curve: RoadCurve[];
}

export interface PropsPreset {
  perChunk: [number, number];
  /** Cones placed regularly along the shoulder, per chunk (0 = none). */
  shoulderCones: number;
  items: PropSpec[];
}

export interface TrafficPreset {
  /** Built-in traffic is out of scope for the MVP; drawings provide moving objects. */
  enabled: boolean;
}

export interface AudioPreset {
  ambient: 'construction' | 'none';
  engineBaseHz: number;
}

export interface WorldPreset {
  id: string;
  name: string;
  sky: SkyPreset;
  terrain: TerrainPreset;
  road: RoadPreset;
  props: PropsPreset;
  traffic: TrafficPreset;
  audio: AudioPreset;
}
