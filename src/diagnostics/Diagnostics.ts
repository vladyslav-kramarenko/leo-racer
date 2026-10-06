import type { DriveMode } from '../driving/SteeringMixer';
import type { InputSource } from '../input/SteeringState';
import type { FinishReason, SessionPhase } from '../session/SessionState';

export interface LiveDiagnostics {
  fps: number;
  resolution: string;
  devicePixelRatio: number;
  inputSource: InputSource;
  gamepadId: string;
  haptics: string;
  gear: string;
  steeringAxis: string;
  rawSteering: number;
  gamepadAxes: string;
  pedalBrake: string;
  pedalThrottle: string;
  normalizedSteering: number;
  tilt: string;
  speedKmh: number;
  braking: boolean;
  mode: DriveMode;
  manualWeight: number;
  session: string;
  world: string;
  worldChunks: string;
  activeSprites: number;
  traffic: number;
  drawCalls: number;
  triangles: number;
  appVersion: string;
}

export interface SessionCounters {
  brakePresses: number;
  hornPresses: number;
  manualTakeovers: number;
  autopilotTakeovers: number;
}

/**
 * Local-only session metrics. Nothing is ever sent anywhere automatically;
 * a parent can export them as JSON from the Parent Menu.
 */
export class SessionMetrics {
  private readonly sessionStart = Date.now();
  private drivingStart: number | null = null;
  private manualMs = 0;
  private autopilotMs = 0;
  private firstInputMs: number | null = null;
  private fpsSamples = 0;
  private fpsSum = 0;
  private fpsMin = Infinity;
  private brakePresses = 0;
  private hornPresses = 0;
  private sessionsFinished = 0;
  private finishReason: FinishReason | null = null;
  private readonly impressions = new Map<string, number>();

  markDrivingStarted(): void {
    this.drivingStart ??= Date.now();
  }

  tick(dtMs: number, mode: DriveMode, fps: number): void {
    if (mode === 'manual') this.manualMs += dtMs;
    else this.autopilotMs += dtMs;
    if (fps > 0) {
      this.fpsSamples++;
      this.fpsSum += fps;
      this.fpsMin = Math.min(this.fpsMin, fps);
    }
  }

  markInput(): void {
    if (this.firstInputMs === null && this.drivingStart !== null) this.firstInputMs = Date.now() - this.drivingStart;
  }

  markBrake(): void {
    this.brakePresses++;
  }

  markHorn(): void {
    this.hornPresses++;
  }

  markSessionFinished(reason: FinishReason): void {
    this.sessionsFinished++;
    this.finishReason = reason;
  }

  /** A drawing was shown in the world (spawned as a sprite). */
  markImpression(drawingId: string): void {
    this.impressions.set(drawingId, (this.impressions.get(drawingId) ?? 0) + 1);
  }

  export(extra: {
    drawings: number;
    inputSources: InputSource[];
    tiltUsed: boolean;
    touchBrakeUsed: boolean;
    takeovers: { manual: number; autopilot: number };
    sessionPhase: SessionPhase;
    playTimeMinutes: number | null;
    world: string;
    live: LiveDiagnostics;
    userAgent: string;
  }): object {
    const impressions = [...this.impressions.values()];
    return {
      exportedAt: new Date().toISOString(),
      appVersion: extra.live.appVersion,
      world: extra.world,
      sessionDurationSec: Math.round((Date.now() - this.sessionStart) / 1000),
      manualDrivingSec: Math.round(this.manualMs / 1000),
      autopilotSec: Math.round(this.autopilotMs / 1000),
      timeToFirstInputSec: this.firstInputMs === null ? null : +(this.firstInputMs / 1000).toFixed(1),
      counters: {
        brakePresses: this.brakePresses,
        hornPresses: this.hornPresses,
        manualTakeovers: extra.takeovers.manual,
        autopilotTakeovers: extra.takeovers.autopilot,
      },
      inputSourcesUsed: extra.inputSources,
      tiltUsed: extra.tiltUsed,
      touchBrakeUsed: extra.touchBrakeUsed,
      session: {
        playTimeMinutes: extra.playTimeMinutes,
        phase: extra.sessionPhase,
        sessionsFinished: this.sessionsFinished,
        finishReason: this.finishReason ?? (extra.sessionPhase === 'running' ? 'stillRunning' : null),
      },
      drawings: {
        count: extra.drawings,
        // Ids are random UUIDs — no child data.
        impressionsTotal: impressions.reduce((a, b) => a + b, 0),
        impressionsPerDrawing: Object.fromEntries(this.impressions),
      },
      fps: {
        current: extra.live.fps,
        average: this.fpsSamples ? Math.round(this.fpsSum / this.fpsSamples) : null,
        min: Number.isFinite(this.fpsMin) ? this.fpsMin : null,
      },
      display: { resolution: extra.live.resolution, devicePixelRatio: extra.live.devicePixelRatio },
      gamepad: { id: extra.live.gamepadId, steeringAxis: extra.live.steeringAxis },
      userAgent: extra.userAgent,
    };
  }
}
