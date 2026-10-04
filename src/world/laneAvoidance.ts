import { CONFIG } from '../game/config';

export interface AvoidanceConfig {
  laneOffset: number;
  shoulderOffset: number;
  clearance: number;
  lookAhead: number;
  lookBehind: number;
}

export interface AvoidanceInput {
  /** NPC position along the road and its preferred lateral offset. */
  s: number;
  laneD: number;
  /** NPC's current lateral offset. */
  d: number;
  busS: number;
  busD: number;
  /** Required centre-to-centre gap (defaults to config clearance). */
  clearance?: number;
}

/**
 * Where an NPC on the road (traffic or a moving drawing) wants to be sideways.
 * There is no collision system: when the bus comes close, the NPC simply makes way —
 * preferably onto its own shoulder, otherwise into the other lane or the far shoulder.
 */
export function avoidanceTarget(input: AvoidanceInput, cfg: AvoidanceConfig = CONFIG.lanes): number {
  const clearance = input.clearance ?? cfg.clearance;
  const ds = input.s - input.busS;
  if (ds > cfg.lookAhead || ds < -cfg.lookBehind) return input.laneD;
  if (Math.abs(input.laneD - input.busD) >= clearance) return input.laneD;

  const side = Math.sign(input.laneD) || 1;
  const candidates = [side * cfg.shoulderOffset, -side * cfg.laneOffset, -side * cfg.shoulderOffset];
  let best: number | null = null;
  let bestCost = Infinity;
  for (const c of candidates) {
    if (Math.abs(c - input.busD) < clearance) continue;
    // Prefer short moves; crossing to the other side of the bus costs extra.
    const crosses = Math.sign(c - input.busD) !== Math.sign(input.d - input.busD);
    const cost = Math.abs(c - input.d) + (crosses ? 4 : 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = c;
    }
  }
  return best ?? side * cfg.shoulderOffset;
}

/** True when an NPC visibly overlaps the bus (used to recycle it as a last resort). */
export function overlapsBus(s: number, d: number, busS: number, busD: number, halfWidth: number): boolean {
  return Math.abs(s - busS) < 4.5 && Math.abs(d - busD) < 1.25 + halfWidth;
}
