import * as THREE from 'three';
import type { AudioManager } from '../audio/AudioManager';
import type { LiveDiagnostics } from '../diagnostics/Diagnostics';
import { SessionMetrics } from '../diagnostics/Diagnostics';
import { DrawingSpriteLayer, type SpriteSource } from '../drawings/DrawingSprite';
import { Autopilot } from '../driving/Autopilot';
import { SteeringMixer } from '../driving/SteeringMixer';
import { VehicleController } from '../driving/VehicleController';
import { InputManager } from '../input/InputManager';
import type { WheelCalibration } from '../input/SteeringState';
import { SessionManager } from '../session/SessionManager';
import type { SessionPhase } from '../session/SessionState';
import { TrafficManager, type TrafficDensity } from '../traffic/TrafficManager';
import { Bus } from '../vehicle/Bus';
import type { VehicleModel } from '../vehicle/VehicleModel';
import type { WorldPreset } from '../world/presets/types';
import { WorldManager } from '../world/WorldManager';
import { CameraRig } from './CameraRig';
import { CONFIG } from './config';
import { GameLoop } from './GameLoop';
import { SceneManager } from './SceneManager';

export interface GameOptions {
  playTimeMinutes: number | null;
  trafficDensity: TrafficDensity;
  /** Override for automated tests only. */
  endingDurationMs?: number;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Wires the independent layers together:
 *   DRIVE   (input → mixer ↔ autopilot → vehicle controller)
 *   WORLD   (preset → road, chunks, props, traffic)
 *   CREATE  (drawings → sprites), fed in through setDrawings()
 *   SESSION (play-time limit → gentle ending)
 */
export class Game {
  readonly scenes: SceneManager;
  readonly input = new InputManager();
  readonly metrics = new SessionMetrics();
  readonly session: SessionManager;
  readonly traffic: TrafficManager;
  private readonly mixer = new SteeringMixer();
  private readonly autopilot = new Autopilot();
  private readonly vehicle = new VehicleController();
  private readonly world: WorldManager;
  private readonly bus: VehicleModel;
  private readonly cameraRig: CameraRig;
  private readonly sprites: DrawingSpriteLayer;
  private readonly loop: GameLoop;
  private readonly busPosition = new THREE.Vector3();
  private readonly phaseListeners: ((phase: SessionPhase) => void)[] = [];
  private driving = false;
  private paused = false;
  private timeSec = 0;
  private autoSteer = 0;
  private mixedSteer = 0;
  private wasBraking = false;
  private lastPhase: SessionPhase = 'idle';
  private engineLevel = 1;

  constructor(
    container: HTMLElement,
    readonly preset: WorldPreset,
    private readonly audio: AudioManager,
    options: GameOptions,
  ) {
    this.scenes = new SceneManager(container);
    this.world = new WorldManager(preset, this.scenes.scene);
    this.bus = new Bus();
    this.scenes.scene.add(this.bus.object);
    this.traffic = new TrafficManager(this.world.road, preset.traffic, options.trafficDensity);
    this.scenes.scene.add(this.traffic.group);
    this.sprites = new DrawingSpriteLayer(this.world.road);
    this.sprites.onSpawn((id) => this.metrics.markImpression(id));
    this.scenes.scene.add(this.sprites.group);
    this.cameraRig = new CameraRig(this.scenes.camera, this.world.road);
    this.session = new SessionManager(options.playTimeMinutes, options.endingDurationMs);
    this.loop = new GameLoop((dt, now) => this.frame(dt, now));

    this.input.onHorn(() => {
      if (!this.driving || this.paused) return;
      this.metrics.markHorn();
      this.audio.horn();
    });
  }

  /** Autopilot attract mode runs behind the start screen right away. */
  boot(): void {
    this.loop.start();
  }

  /** START DRIVING: enable input and sound; the play-time countdown starts now. */
  startDriving(): void {
    if (this.driving) return;
    this.driving = true;
    this.input.attach(this.scenes.renderer.domElement);
    this.metrics.markDrivingStarted();
    this.session.start();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.input.touchBrake.setEnabled(!paused && !this.isEnding());
  }

  isPaused(): boolean {
    return this.paused;
  }

  // ---------------------------------------------------------------- session

  setPlayTimeMinutes(minutes: number | null): void {
    this.session.setLimitMinutes(minutes);
  }

  /** Parent-triggered (or time limit) gentle ending. */
  beginEndingSequence(): void {
    this.session.beginEnding();
  }

  isEnding(): boolean {
    return this.session.phase === 'ending' || this.session.phase === 'finished';
  }

  /** Parent action only: start a fresh session after the ending. */
  restartSession(): void {
    this.session.restart();
    this.vehicle.setCruiseScale(1);
    this.mixer.setForcedAutopilot(false);
    this.input.touchBrake.setEnabled(!this.paused);
    this.setEngineLevel(1);
  }

  onSessionPhase(listener: (phase: SessionPhase) => void): void {
    this.phaseListeners.push(listener);
  }

  // ---------------------------------------------------------------- world / drawings

  setTrafficDensity(density: TrafficDensity): void {
    this.traffic.setDensity(density);
  }

  setCalibration(cal: WheelCalibration | null): void {
    this.input.setCalibration(cal);
  }

  setDrawings(sources: readonly SpriteSource[]): void {
    this.sprites.setSources(sources);
  }

  showDrawingSoon(id: string): void {
    void this.sprites.spawnSoon(id, this.vehicle.state.progress);
  }

  // ---------------------------------------------------------------- loop

  private frame(dt: number, now: number): void {
    if (!this.paused) this.simulate(dt, now);
    this.scenes.render();
  }

  private simulate(dt: number, now: number): void {
    const dtMs = dt * 1000;
    this.timeSec += dt;
    const state = this.vehicle.state;

    // Paused frames never reach here, so Parent Menu time never counts.
    if (this.driving) this.session.tick(dtMs, true);
    const phase = this.session.phase;
    const ending = phase === 'ending' || phase === 'finished';
    if (phase !== this.lastPhase) this.onPhaseChange(phase);

    let manual = 0;
    let held = false;
    let braking = false;
    if (this.driving) {
      this.input.update(dtMs);
      // During the ending the child's steering and brake are ignored; the horn still works.
      if (!ending) {
        manual = this.input.getSteering();
        held = this.input.isHeldActive();
        braking = this.input.isBraking();
      }
    }
    if (braking && !this.wasBraking) {
      this.audio.airBrake();
      this.metrics.markBrake();
    }
    this.wasBraking = braking;

    // Ending: autopilot pulls over to the shoulder, then slows to a gentle stop.
    const p = this.session.endingProgress();
    const pullOver = ending ? smoothstep(0, CONFIG.session.slowFrom, p) : 0;
    const cruise = ending ? 1 - smoothstep(CONFIG.session.slowFrom, CONFIG.session.stopAt, p) : 1;
    this.vehicle.setCruiseScale(cruise);
    if (ending) this.setEngineLevel(phase === 'finished' ? 0 : 0.35 + 0.65 * cruise);

    this.autoSteer = this.autopilot.getSteering({
      timeSec: this.timeSec,
      dtSec: dt,
      lateralOffset: state.lateralOffset,
      lateralVelocity: state.lateralVelocity,
      curvatureAhead: this.world.road.curvature(state.progress + CONFIG.autopilot.lookahead),
      pullOver,
      pullOverOffset: CONFIG.session.pullOverOffset,
    });
    const before = this.mixer.getLastActivityMs();
    this.mixedSteer = this.mixer.update(manual, this.autoSteer, now, dtMs, held);
    if (this.mixer.getLastActivityMs() !== before) this.metrics.markInput();

    this.vehicle.update(dt, this.mixedSteer, braking);

    // Place the bus on the road.
    const frame = this.world.road.frame(state.progress);
    this.busPosition.set(frame.x + frame.rx * state.lateralOffset, 0, frame.z + frame.rz * state.lateralOffset);
    this.bus.object.position.copy(this.busPosition);
    this.bus.object.rotation.y = -(frame.heading + state.yaw);
    this.bus.animate(dt, state, this.timeSec);

    this.world.update(state.progress, this.busPosition, this.timeSec, dt);
    this.traffic.update(dt, this.timeSec, { s: state.progress, d: state.lateralOffset });
    this.sprites.update(dt, state.progress, state.lateralOffset);
    this.cameraRig.update(dt, state.progress, state.lateralOffset, this.mixedSteer);
    this.audio.update(dt, this.mixedSteer, state.speed / CONFIG.driving.speed, this.driving);
    if (this.driving) this.metrics.tick(dtMs, this.mixer.getMode(), this.loop.getFps());
  }

  private onPhaseChange(phase: SessionPhase): void {
    this.lastPhase = phase;
    if (phase === 'ending') {
      this.mixer.setForcedAutopilot(true);
      this.input.touchBrake.setEnabled(false);
    }
    if (phase === 'finished') this.metrics.markSessionFinished('timeLimit');
    for (const listener of this.phaseListeners) listener(phase);
  }

  private setEngineLevel(level: number): void {
    if (Math.abs(level - this.engineLevel) < 0.02) return;
    this.engineLevel = level;
    this.audio.setEngineLevel(level);
  }

  // ---------------------------------------------------------------- diagnostics

  getLive(): LiveDiagnostics {
    const cal = this.input.gamepad.getCalibration();
    const pad = this.input.gamepad.getConnected();
    const res = this.scenes.resolution();
    const tilt = this.input.tilt;
    const remaining = this.session.remainingMs();
    return {
      fps: this.loop.getFps(),
      resolution: `${res.width}×${res.height}`,
      devicePixelRatio: window.devicePixelRatio,
      inputSource: this.input.getSource(),
      gamepadId: pad?.id ?? '(none)',
      steeringAxis: cal && pad && cal.gamepadId === pad.id ? `${cal.steeringAxis}${cal.invertAxis ? ' (inv)' : ''}` : `${CONFIG.gamepad.defaultAxis} (default)`,
      rawSteering: this.input.gamepad.getRaw(),
      normalizedSteering: this.input.getSteering(),
      tilt: !tilt.isEnabled() ? 'off' : tilt.hasSignal() ? `${tilt.getRelativeAngle().toFixed(1)}° → ${tilt.getSteering().toFixed(2)}` : 'no signal',
      speedKmh: this.vehicle.state.speed * 3.6,
      braking: this.vehicle.state.braking,
      mode: this.mixer.getMode(),
      manualWeight: this.mixer.getManualWeight(),
      session: `${this.session.phase}${remaining === null ? ' (unlimited)' : ` (${Math.ceil(remaining / 1000)} s left)`}`,
      world: this.preset.id,
      worldChunks: this.world.chunks.activeIndices().join(','),
      activeSprites: this.sprites.activeCount(),
      traffic: this.traffic.activeCount(),
      drawCalls: this.scenes.drawCalls(),
      triangles: this.scenes.triangles(),
      appVersion: __APP_VERSION__,
    };
  }

  getTakeoverCounts(): { manual: number; autopilot: number } {
    return this.mixer.getTakeoverCounts();
  }

  /** Read-only snapshot for automated tests and the diagnostics overlay. */
  debugState() {
    const s = this.vehicle.state;
    return {
      driving: this.driving,
      paused: this.paused,
      world: this.preset.id,
      phase: this.session.phase,
      progress: s.progress,
      lateralOffset: s.lateralOffset,
      speed: s.speed,
      braking: s.braking,
      steering: this.mixedSteer,
      manualSteering: this.input.getSteering(),
      mode: this.mixer.getMode(),
      activeSprites: this.sprites.activeCount(),
      traffic: this.traffic.activeCount(),
    };
  }
}
