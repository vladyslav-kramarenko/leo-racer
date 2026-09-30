import { CONFIG } from '../game/config';
import { GamepadInput } from './GamepadInput';
import { KeyboardInput } from './KeyboardInput';
import type { InputSource, SteeringInput, WheelCalibration } from './SteeringState';

/**
 * Merges all physical devices into one normalised steering value.
 * The rest of the game only calls getSteering(); it never knows which device is used.
 */
export class InputManager implements SteeringInput {
  readonly keyboard = new KeyboardInput();
  readonly gamepad = new GamepadInput();

  private source: InputSource = 'none';
  private lastGamepad = 0;
  private readonly used = new Set<InputSource>();
  private detach: (() => void) | null = null;

  attach(): void {
    this.detach = this.keyboard.attach(window);
  }

  dispose(): void {
    this.detach?.();
  }

  setCalibration(cal: WheelCalibration | null): void {
    this.gamepad.setCalibration(cal);
  }

  onHorn(listener: () => void): void {
    this.keyboard.onHorn(listener);
    this.gamepad.onHorn(listener);
  }

  update(dtMs: number): void {
    this.keyboard.update(dtMs);
    this.gamepad.update();

    const pad = this.gamepad.getSteering();
    const padMoved = Math.abs(pad - this.lastGamepad) > CONFIG.mixer.INPUT_ACTIVITY_THRESHOLD;
    this.lastGamepad = pad;

    // Whichever device was touched most recently owns steering.
    if (this.keyboard.consumeKeyEvent() || this.keyboard.isHeld()) this.setSource('keyboard');
    else if (padMoved) this.setSource('gamepad');
    else if (this.source === 'none' && this.gamepad.getConnected()) this.source = 'gamepad';
  }

  getSteering(): number {
    if (this.source === 'keyboard') return this.keyboard.getSteering();
    if (this.source === 'gamepad') return this.gamepad.getSteering();
    return 0;
  }

  /**
   * A held steering key is always deliberate, so it counts as activity even when
   * the value has stopped changing. Wheel activity is detected from changes only.
   */
  isHeldActive(): boolean {
    return this.source === 'keyboard' && this.keyboard.isHeld();
  }

  getSource(): InputSource {
    return this.source;
  }

  getUsedSources(): InputSource[] {
    return [...this.used];
  }

  private setSource(source: InputSource): void {
    this.source = source;
    this.used.add(source);
  }
}
