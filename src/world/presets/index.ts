import { city } from './city';
import { construction } from './construction';
import { farm } from './farm';
import { nature } from './nature';
import type { WorldPreset } from './types';

const PRESETS: Record<string, WorldPreset> = Object.fromEntries(
  [construction, nature, farm, city].map((p) => [p.id, p]),
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
  if (!preset.props?.items?.length) errors.push('props.items must not be empty');
  const [min, max] = preset.props?.perChunk ?? [0, -1];
  if (min < 0 || max < min) errors.push('props.perChunk must be [min, max] with 0 <= min <= max');
  preset.props?.items?.forEach((p) => {
    if (p.maxDistance < p.minDistance) errors.push(`prop ${p.kind}: maxDistance < minDistance`);
    if (p.weight <= 0) errors.push(`prop ${p.kind}: weight must be positive`);
    // Nothing may stand where the bus can drive (hard limit 3.3 m + half bus width + margin).
    if (p.minDistance < -1.1) errors.push(`prop ${p.kind}: too close to the driving corridor`);
  });
  if (!preset.traffic) errors.push('traffic is required');
  if (preset.traffic?.enabled && !preset.traffic.vehicles.length) errors.push('traffic.vehicles must not be empty');
  if (!preset.audio?.ambience) errors.push('audio.ambience is required');
  return errors;
}

export type { WorldPreset } from './types';
