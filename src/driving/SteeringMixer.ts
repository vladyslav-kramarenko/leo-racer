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
 */
export class SteeringMixer {
  private mode: DriveMode = 'autopilot';
  /** 1 = fully manual, 0 = fully autopilot. */
  private manualWeight = 0;
  private previousManual: number | null = null;
  private lastActivityMs = -Infinity;
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
    const changed =
      this.previousManual !== null && Math.abs(manual - this.previousManual) > this.options.activityThreshold;
    this.previousManual = manual;

    if (changed || forceActive) {
      this.lastActivityMs = nowMs;
      this.mode = 'manual';
      // Instant takeover: the child must feel control immediately.
      this.manualWeight = 1;
    } else if (this.mode === 'manual' && nowMs - this.lastActivityMs >= this.options.idleTimeoutMs) {
      this.mode = 'autopilot';
    }

    if (this.mode === 'autopilot' && this.manualWeight > 0) {
      this.manualWeight = Math.max(0, this.manualWeight - dtMs / this.options.blendMs);
    }

    const w = this.manualWeight;
    return clamp(w * manual + (1 - w) * auto, -1, 1);
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
}
