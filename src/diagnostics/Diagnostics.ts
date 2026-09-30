import type { DriveMode } from '../driving/SteeringMixer';
import type { InputSource } from '../input/SteeringState';

export interface LiveDiagnostics {
  fps: number;
  resolution: string;
  devicePixelRatio: number;
  inputSource: InputSource;
  gamepadId: string;
  steeringAxis: string;
  rawSteering: number;
  normalizedSteering: number;
  speedKmh: number;
  braking: boolean;
  mode: DriveMode;
  manualWeight: number;
  worldChunks: string;
  activeSprites: number;
  drawCalls: number;
  appVersion: string;
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

  export(extra: { drawings: number; inputSources: InputSource[]; live: LiveDiagnostics; userAgent: string }): object {
    return {
      exportedAt: new Date().toISOString(),
      appVersion: extra.live.appVersion,
      sessionDurationSec: Math.round((Date.now() - this.sessionStart) / 1000),
      manualDrivingSec: Math.round(this.manualMs / 1000),
      autopilotSec: Math.round(this.autopilotMs / 1000),
      timeToFirstInputSec: this.firstInputMs === null ? null : +(this.firstInputMs / 1000).toFixed(1),
      numberOfDrawings: extra.drawings,
      inputSourcesUsed: extra.inputSources,
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
