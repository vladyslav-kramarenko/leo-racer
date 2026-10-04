import { CONFIG } from '../game/config';
import { clamp } from '../input/SteeringState';

export type DriveMode = 'autopilot' | 'manual';

export interface MixerOptions {
  idleTimeoutMs: number;
  activityThreshold: number;
  blendMs: number;
}

const DEFAULTS: MixerOptions = {
  idleTimeoutMs: CONFIG.mixer.MANUAL_IDLE_TIMEOUT_MS,
  activityThreshold: CONFIG.mixer.INPUT_ACTIVITY_THRESHOLD,
  blendMs: CONFIG.mixer.AUTOPILOT_BLEND_MS,
};

/**
 * Continuous manual ↔ autopilot hand-over.
 * - Any meaningful change in human steering switches to manual instantly.
 * - After `idleTimeoutMs` without activity, autopilot blends back in over `blendMs`.
 *
 * Activity is measured against the value at the last detected activity (an anchor),
 * not frame-to-frame: a slow, steady turn accumulates and is detected, while jitter
 * around a resting position never drifts far enough from the anchor to count.
 */
export class SteeringMixer {
  private mode: DriveMode = 'autopilot';
  /** 1 = fully manual, 0 = fully autopilot. */
  private manualWeight = 0;
  private anchor: number | null = null;
  private lastActivityMs = -Infinity;
  private forcedAutopilot = false;
  private manualTakeovers = 0;
  private autopilotTakeovers = 0;
  private readonly options: MixerOptions;

  constructor(options: Partial<MixerOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /**
   * @param manual   Human steering, -1…1.
   * @param auto     Autopilot steering, -1…1.
   * @param nowMs    Monotonic time.
   * @param dtMs     Frame time.
   * @param forceActive  True when the input device reports deliberate input (e.g. held key).
   */
  update(manual: number, auto: number, nowMs: number, dtMs: number, forceActive = false): number {
    if (this.anchor === null) this.anchor = manual;
    const changed = Math.abs(manual - this.anchor) > this.options.activityThreshold;

    if (!this.forcedAutopilot && (changed || forceActive)) {
      this.anchor = manual;
      this.lastActivityMs = nowMs;
      if (this.mode === 'autopilot') this.manualTakeovers++;
      this.mode = 'manual';
      // Instant takeover: the child must feel control immediately.
      this.manualWeight = 1;
    } else if (
      this.mode === 'manual' &&
      (this.forcedAutopilot || nowMs - this.lastActivityMs >= this.options.idleTimeoutMs)
    ) {
      this.mode = 'autopilot';
      this.autopilotTakeovers++;
    }
    if (this.forcedAutopilot) this.anchor = manual;

    if (this.mode === 'autopilot' && this.manualWeight > 0) {
      this.manualWeight = Math.max(0, this.manualWeight - dtMs / this.options.blendMs);
    }

    const w = this.manualWeight;
    return clamp(w * manual + (1 - w) * auto, -1, 1);
  }

  /** While forced, human input is ignored and autopilot blends in (session ending). */
  setForcedAutopilot(forced: boolean): void {
    this.forcedAutopilot = forced;
  }

  getMode(): DriveMode {
    return this.mode;
  }

  getManualWeight(): number {
    return this.manualWeight;
  }

  /** Time of the last human activity, or -Infinity if none yet. */
  getLastActivityMs(): number {
    return this.lastActivityMs;
  }

  getTakeoverCounts(): { manual: number; autopilot: number } {
    return { manual: this.manualTakeovers, autopilot: this.autopilotTakeovers };
  }
}
