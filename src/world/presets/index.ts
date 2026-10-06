import { city } from './city';
import { construction } from './construction';
import { farm } from './farm';
import { nature } from './nature';
import { seaToSky } from './seaToSky';
import { winter } from './winter';
import type { WorldPreset } from './types';

const PRESETS: Record<string, WorldPreset> = Object.fromEntries(
  [construction, seaToSky, nature, winter, farm, city].map((p) => [p.id, p]),
);

export const DEFAULT_WORLD_ID = construction.id;

export function listPresets(): WorldPreset[] {
  return Object.values(PRESETS);
}

/** Returns the requested preset, falling back to the default for unknown ids. */
export function getPreset(id: string | null | undefined): WorldPreset {
  return (id && PRESETS[id]) || PRESETS[DEFAULT_WORLD_ID];
}

/** Structural validation so broken presets fail loudly in tests, not in front of a child. */
export function validatePreset(preset: WorldPreset): string[] {
  const errors: string[] = [];
  if (!preset.id) errors.push('id is required');
  if (!preset.sky || preset.sky.fogFar <= preset.sky.fogNear) errors.push('sky.fogFar must exceed sky.fogNear');
  const hills = preset.sky?.hills;
  if (!hills?.colors?.length) errors.push('sky.hills.colors must not be empty');
  if (hills && (hills.height[0] > hills.height[1] || hills.width[0] > hills.width[1])) {
    errors.push('sky.hills height/width ranges must be [min, max]');
  }
  if (!preset.road?.curve?.length) errors.push('road.curve needs at least one component');
  preset.road?.curve?.forEach((c, i) => {
    if (c.wavelength <= 0) errors.push(`road.curve[${i}].wavelength must be positive`);
  });
  preset.terrain?.bands?.forEach((b, i) => {
    if (b.to <= b.from) errors.push(`terrain.bands[${i}]: to must exceed from`);
    if (b.from < 6) errors.push(`terrain.bands[${i}]: must start beyond the road (>= 6 m)`);
  });
  if (!preset.props?.items?.some((i) => !i.every)) errors.push('props.items needs at least one regular (non-landmark) prop');
  const [min, max] = preset.props?.perChunk ?? [0, -1];
  if (min < 0 || max < min) errors.push('props.perChunk must be [min, max] with 0 <= min <= max');
  preset.props?.items?.forEach((p) => {
    if (p.maxDistance < p.minDistance) errors.push(`prop ${p.kind}: maxDistance < minDistance`);
    if (p.weight <= 0) errors.push(`prop ${p.kind}: weight must be positive`);
    // Nothing may stand where the bus can drive (hard limit 3.3 m + half bus width + margin).
    if (p.minDistance < -1.1) errors.push(`prop ${p.kind}: too close to the driving corridor`);
    if (p.every && !(p.every.chunks >= 1)) errors.push(`prop ${p.kind}: every.chunks must be >= 1`);
  });
  if (preset.guideway) {
    const g = preset.guideway;
    // Columns must stand outside the driving corridor and the lane-avoidance shoulder.
    if (g.offset < 7.5) errors.push('guideway.offset must be >= 7.5 m (outside the road)');
    if (g.height < 5) errors.push('guideway.height must be >= 5 m (clear of vehicles)');
    if (g.train.cars < 1 || g.train.speed <= 0) errors.push('guideway.train needs cars and a positive speed');
  }
  if (preset.freightRailway) {
    const rail = preset.freightRailway;
    if (!Number.isFinite(rail.offset) || rail.offset < 10) errors.push('freightRailway.offset must clear the road and shoulder');
    if (!Number.isInteger(rail.wagons) || rail.wagons < 1 || rail.wagons > 12) errors.push('freightRailway.wagons must be 1–12');
    if (!Number.isFinite(rail.speed) || rail.speed <= 0) errors.push('freightRailway.speed must be positive');
    if (rail.intervalSec[0] <= 0 || rail.intervalSec[1] < rail.intervalSec[0]) errors.push('freightRailway.intervalSec must be a positive [min, max]');
  }
  if (!preset.traffic) errors.push('traffic is required');
  if (preset.santaSleigh) {
    const { altitude, intervalSec: [low, high] } = preset.santaSleigh;
    if (!Number.isFinite(altitude) || altitude < 34) errors.push('santaSleigh.altitude must clear the ski village (>= 34 m)');
    if (!Number.isFinite(low) || !Number.isFinite(high) || low < 1 || high < low) errors.push('santaSleigh.intervalSec must be a positive [min, max]');
  }
  if (preset.snowfall && (!Number.isInteger(preset.snowfall.count) || preset.snowfall.count < 1
    || preset.snowfall.count > 1000 || !Number.isFinite(preset.snowfall.speed) || preset.snowfall.speed <= 0)) {
    errors.push('snowfall needs 1–1000 flakes and a positive speed');
  }
  if (preset.traffic?.enabled && !preset.traffic.vehicles.length) errors.push('traffic.vehicles must not be empty');
  if (!preset.audio?.ambience) errors.push('audio.ambience is required');
  return errors;
}

export type { WorldPreset } from './types';
