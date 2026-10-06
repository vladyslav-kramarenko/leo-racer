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
  | 'pipeTrench'
  | 'sign'
  | 'excavator'
  | 'dumpTruck'
  | 'quarry'
  | 'crane'
  | 'gravel'
  | 'unfinishedBuilding'
  // Nature
  | 'pine'
  | 'roundTree'
  | 'rock'
  | 'bush'
  | 'flowers'
  | 'log'
  | 'viewpoint'
  | 'sailboat'
  | 'gondola'
  | 'elk'
  | 'moose'
  | 'bear'
  | 'bighorn'
  | 'wolf'
  | 'wildlifeBridge'
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
  | 'parkedCar'
  | 'glassTower'
  | 'blossomTree'
  // Landmarks (Vancouver-inspired, simplified)
  | 'scienceWorld'
  | 'canadaPlace'
  | 'harbourCentre'
  | 'steamClock';

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
  /** A bridge centered over the road; its model must provide vehicle clearance. */
  roadCentered?: boolean;
  /**
   * Landmarks: instead of a random pick, place exactly one in every `chunks`-th road chunk
   * (chunk index ≡ offset mod chunks), so a big landmark shows up now and then, not everywhere.
   */
  every?: { chunks: number; offset?: number };
}

export interface HillsPreset {
  colors: string[];
  height: [number, number];
  width: [number, number];
  /** Optional snow cap colour for mountains. */
  snowCap?: string;
}

/** A distant ring of tower silhouettes (city skyline); follows the vehicle like the hills. */
export interface SkylinePreset {
  colors: string[];
  height: [number, number];
  width: [number, number];
  count: number;
  /** Which side of the road the skyline sits on (default both). */
  side?: Side;
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
  skyline?: SkylinePreset;
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

export type TrafficKind =
  | 'car'
  | 'pickup'
  | 'van'
  | 'dumpTruck'
  | 'mixer'
  | 'tractor'
  | 'cityBus'
  | 'camper'
  /** Low sports car; zooms past where the world lists it under `overtaking`. */
  | 'sportsCar'
  /** Light bar flashes red/blue (below 3 Hz). */
  | 'police';

export interface TrafficPreset {
  enabled: boolean;
  vehicles: TrafficKind[];
  /** Kinds that come from behind and zoom past the bus here; elsewhere they drive like normal traffic. */
  overtaking?: TrafficKind[];
}

export type AmbientEvent = 'clink' | 'chirp' | 'moo' | 'wave' | 'honk' | 'bell' | 'gull';

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

/** Elevated rail alongside the road (SkyTrain-style) with an occasional train. */
export interface GuidewayPreset {
  side: 'left' | 'right';
  /** Lateral offset from the road centre (must clear the sidewalk props). */
  offset: number;
  /** Height of the beam's underside, metres. */
  height: number;
  width: number;
  thickness: number;
  color: string;
  columnSpacing: number;
  train: {
    cars: number;
    carLength: number;
    /** m/s; trains overtake the bus or come the other way. */
    speed: number;
    intervalSec: [number, number];
    colors: { body: string; stripe: string; window: string };
  };
}

export interface WorldPreset {
  id: string;
  name: string;
  /** Picture for the Parent Menu world picker (served from /public). */
  thumbnail?: string;
  sky: SkyPreset;
  terrain: TerrainPreset;
  road: RoadPreset;
  props: PropsPreset;
  traffic: TrafficPreset;
  guideway?: GuidewayPreset;
  freightRailway?: FreightRailwayPreset;
  audio: AudioPreset;
}

/** Historical steam freight on ground-level rails to the right of the road. */
export interface FreightRailwayPreset {
  offset: number;
  wagons: number;
  speed: number;
  intervalSec: [number, number];
}
