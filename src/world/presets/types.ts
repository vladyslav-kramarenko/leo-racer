/**
 * A world preset is pure data. Adding a world means adding a new preset
 * (and optionally new prop kinds to the prop library) — the engine does not change.
 */

export type PropKind =
  // Construction
  | 'cone'
  | 'barrier'
  | 'concreteBlock'
  | 'pipes'
  | 'sign'
  | 'excavator'
  | 'dumpTruck'
  | 'crane'
  | 'gravel'
  // Nature
  | 'pine'
  | 'roundTree'
  | 'rock'
  | 'bush'
  | 'flowers'
  | 'log'
  | 'viewpoint'
  | 'sailboat'
  // Farm
  | 'fence'
  | 'barn'
  | 'silo'
  | 'hayBale'
  | 'cow'
  | 'sheep'
  | 'windmill'
  | 'tractor'
  // City
  | 'house'
  | 'building'
  | 'shop'
  | 'trafficLight'
  | 'streetLamp'
  | 'parkedCar';

export type Side = 'left' | 'right' | 'both';

export interface PropSpec {
  kind: PropKind;
  /** Relative probability of being picked. */
  weight: number;
  /** Distance from the road edge, metres (negative = on the shoulder). */
  minDistance: number;
  maxDistance: number;
  scale: [number, number];
  maxPerChunk: number;
  /** 'road' = side-on to the road, 'traffic' = facing the approaching bus, 'away' = back to the road, default random. */
  facing?: 'road' | 'traffic' | 'away' | 'random';
  /** Which side of the road the prop may appear on (default both). */
  side?: Side;
}

export interface HillsPreset {
  colors: string[];
  height: [number, number];
  width: [number, number];
  /** Optional snow cap colour for mountains. */
  snowCap?: string;
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
  hills: HillsPreset;
}

/** A coloured strip that follows the road (water, fields, sidewalk…). Offsets from the road centre. */
export interface GroundBand {
  side: Side;
  from: number;
  to: number;
  color: string;
  /** Height above the terrain (default 0.01). */
  y?: number;
}

export interface TerrainPreset {
  base: string;
  speckles: string[];
  patches: string[];
  bands?: GroundBand[];
}

export interface RoadCurve {
  amplitude: number;
  wavelength: number;
  phase: number;
}

export interface RoadPreset {
  asphalt: string;
  asphaltSpeckle: string;
  /** null = no edge lines (country road). */
  edgeLine: string | null;
  /** null = no centre line. */
  centerLine: string | null;
  shoulder: string;
  curve: RoadCurve[];
}

export interface PropsPreset {
  perChunk: [number, number];
  /** Props placed regularly along the shoulder, per chunk (0 = none). */
  shoulderCones: number;
  /** Which prop is used for the regular shoulder row (default cone). */
  shoulderProp?: PropKind;
  /** Distance of the shoulder row from the road edge (default -1.6, i.e. on the shoulder). */
  shoulderDistance?: number;
  items: PropSpec[];
}

export type TrafficKind = 'car' | 'pickup' | 'van' | 'dumpTruck' | 'mixer' | 'tractor' | 'cityBus' | 'camper';

export interface TrafficPreset {
  enabled: boolean;
  vehicles: TrafficKind[];
}

export type AmbientEvent = 'clink' | 'chirp' | 'moo' | 'wave' | 'honk' | 'bell';

export interface AudioPreset {
  engineBaseHz: number;
  ambience: {
    /** Background noise bed (0 = silent). */
    noiseLevel: number;
    noiseCutoff: number;
    /** Slow swell of the noise bed (waves), 0 = steady. */
    noiseSwellHz?: number;
    events: AmbientEvent[];
    eventInterval: [number, number];
  };
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
