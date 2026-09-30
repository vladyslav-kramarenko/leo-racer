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
import { Bus } from '../vehicle/Bus';
import type { VehicleModel } from '../vehicle/VehicleModel';
import type { WorldPreset } from '../world/presets/types';
import { WorldManager } from '../world/WorldManager';
import { CameraRig } from './CameraRig';
import { CONFIG } from './config';
import { GameLoop } from './GameLoop';
import { SceneManager } from './SceneManager';

/**
 * Wires the three independent layers together:
 *   DRIVE  (input → mixer ↔ autopilot → vehicle controller)
 *   WORLD  (preset → road, chunks, props)
 *   CREATE (drawings → sprites), fed in through setDrawings().
 */
export class Game {
  readonly scenes: SceneManager;
  readonly input = new InputManager();
  readonly metrics = new SessionMetrics();
  private readonly mixer = new SteeringMixer();
  private readonly autopilot = new Autopilot();
  private readonly vehicle = new VehicleController();
  private readonly world: WorldManager;
  private readonly bus: VehicleModel;
  private readonly cameraRig: CameraRig;
  private readonly sprites: DrawingSpriteLayer;
  private readonly loop: GameLoop;
  private readonly busPosition = new THREE.Vector3();
  private driving = false;
  private paused = false;
  private timeSec = 0;
  private autoSteer = 0;
  private mixedSteer = 0;

  constructor(
    container: HTMLElement,
    readonly preset: WorldPreset,
    private readonly audio: AudioManager,
  ) {
    this.scenes = new SceneManager(container);
    this.world = new WorldManager(preset, this.scenes.scene);
    this.bus = new Bus();
    this.scenes.scene.add(this.bus.object);
    this.sprites = new DrawingSpriteLayer(this.world.road);
    this.scenes.scene.add(this.sprites.group);
    this.cameraRig = new CameraRig(this.scenes.camera, this.world.road);
    this.loop = new GameLoop((dt, now) => this.frame(dt, now));

    this.input.onHorn(() => {
      if (this.driving && !this.paused) this.audio.horn();
    });
  }

  /** Autopilot attract mode runs behind the start screen right away. */
  boot(): void {
    this.loop.start();
  }

  /** START DRIVING: enable input and sound. The vehicle keeps its autopilot until touched. */
  startDriving(): void {
    if (this.driving) return;
    this.driving = true;
    this.input.attach();
    this.metrics.markDrivingStarted();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  isPaused(): boolean {
    return this.paused;
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

  private frame(dt: number, now: number): void {
    if (!this.paused) this.simulate(dt, now);
    this.scenes.render();
  }

  private simulate(dt: number, now: number): void {
    const dtMs = dt * 1000;
    this.timeSec += dt;
    const state = this.vehicle.state;

    let manual = 0;
    let held = false;
    if (this.driving) {
      this.input.update(dtMs);
      manual = this.input.getSteering();
      held = this.input.isHeldActive();
    }

    this.autoSteer = this.autopilot.getSteering({
      timeSec: this.timeSec,
      dtSec: dt,
      lateralOffset: state.lateralOffset,
      lateralVelocity: state.lateralVelocity,
      curvatureAhead: this.world.road.curvature(state.progress + CONFIG.autopilot.lookahead),
    });
    const before = this.mixer.getLastActivityMs();
    this.mixedSteer = this.mixer.update(manual, this.autoSteer, now, dtMs, held);
    if (this.mixer.getLastActivityMs() !== before) this.metrics.markInput();

    this.vehicle.update(dt, this.mixedSteer);

    // Place the bus on the road.
    const frame = this.world.road.frame(state.progress);
    this.busPosition.set(frame.x + frame.rx * state.lateralOffset, 0, frame.z + frame.rz * state.lateralOffset);
    this.bus.object.position.copy(this.busPosition);
    this.bus.object.rotation.y = -(frame.heading + state.yaw);
    this.bus.animate(dt, state, this.timeSec);

    this.world.update(state.progress, this.busPosition);
    this.sprites.update(dt, state.progress);
    this.cameraRig.update(dt, state.progress, state.lateralOffset, this.mixedSteer);
    this.audio.update(dt, this.mixedSteer, this.driving);
    if (this.driving) this.metrics.tick(dtMs, this.mixer.getMode(), this.loop.getFps());
  }

  getLive(): LiveDiagnostics {
    const cal = this.input.gamepad.getCalibration();
    const pad = this.input.gamepad.getConnected();
    const res = this.scenes.resolution();
    return {
      fps: this.loop.getFps(),
      resolution: `${res.width}×${res.height}`,
      devicePixelRatio: window.devicePixelRatio,
      inputSource: this.input.getSource(),
      gamepadId: pad?.id ?? '(none)',
      steeringAxis: cal && pad && cal.gamepadId === pad.id ? `${cal.steeringAxis}${cal.invertAxis ? ' (inv)' : ''}` : `${CONFIG.gamepad.defaultAxis} (default)`,
      rawSteering: this.input.gamepad.getRaw(),
      normalizedSteering: this.input.getSteering(),
      mode: this.mixer.getMode(),
      manualWeight: this.mixer.getManualWeight(),
      worldChunks: this.world.chunks.activeIndices().join(','),
      activeSprites: this.sprites.activeCount(),
      drawCalls: this.scenes.drawCalls(),
      appVersion: __APP_VERSION__,
    };
  }

  /** Read-only snapshot for automated tests and the diagnostics overlay. */
  debugState() {
    const s = this.vehicle.state;
    return {
      driving: this.driving,
      paused: this.paused,
      progress: s.progress,
      lateralOffset: s.lateralOffset,
      steering: this.mixedSteer,
      manualSteering: this.input.getSteering(),
      mode: this.mixer.getMode(),
      activeSprites: this.sprites.activeCount(),
    };
  }
}
