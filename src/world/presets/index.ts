import { construction } from './construction';
import type { WorldPreset } from './types';

const PRESETS: Record<string, WorldPreset> = {
  [construction.id]: construction,
};

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
  if (!preset.road?.curve?.length) errors.push('road.curve needs at least one component');
  preset.road?.curve?.forEach((c, i) => {
    if (c.wavelength <= 0) errors.push(`road.curve[${i}].wavelength must be positive`);
  });
  if (!preset.props?.items?.length) errors.push('props.items must not be empty');
  const [min, max] = preset.props?.perChunk ?? [0, -1];
  if (min < 0 || max < min) errors.push('props.perChunk must be [min, max] with 0 <= min <= max');
  preset.props?.items?.forEach((p) => {
    if (p.maxDistance < p.minDistance) errors.push(`prop ${p.kind}: maxDistance < minDistance`);
    if (p.weight <= 0) errors.push(`prop ${p.kind}: weight must be positive`);
  });
  if (!preset.traffic) errors.push('traffic is required');
  if (!preset.audio) errors.push('audio is required');
  return errors;
}

export type { WorldPreset } from './types';
