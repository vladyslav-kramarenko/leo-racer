import { CONFIG } from '../game/config';
import { GamepadInput } from './GamepadInput';
import { KeyboardInput } from './KeyboardInput';
import { pedalSpeedMultiplier, type InputSource, type SteeringInput, type WheelCalibration } from './SteeringState';
import { TiltInput } from './TiltInput';
import { TouchBrake } from './TouchBrake';

/**
 * Merges all physical devices into the three signals the game understands:
 *   steering -1..+1 · brake true/false · horn event.
 * The rest of the game never knows which device is used.
 */
export class InputManager implements SteeringInput {
  readonly keyboard = new KeyboardInput();
  readonly gamepad = new GamepadInput();
  readonly tilt = new TiltInput();
  readonly touchBrake = new TouchBrake();

  private source: InputSource = 'none';
  private lastGamepad = 0;
  private tiltAnchor = 0;
  private readonly used = new Set<InputSource>();
  private readonly detachers: (() => void)[] = [];

  attach(canvas?: HTMLElement): void {
    this.detachers.push(this.keyboard.attach(window));
    this.detachers.push(this.gamepad.haptics.attach());
    if (canvas) this.detachers.push(this.touchBrake.attach(canvas));
  }

  dispose(): void {
    this.detachers.splice(0).forEach((d) => d());
    this.tilt.disable();
  }

  setCalibration(cal: WheelCalibration | null): void {
    this.gamepad.setCalibration(cal);
  }

  onHorn(listener: (variant: number) => void): void {
    this.keyboard.onHorn((variant) => { this.used.add('keyboard'); listener(variant); });
    this.gamepad.onHorn((variant) => { this.used.add('gamepad'); listener(variant); });
  }

  onShift(listener: (direction: -1 | 1) => void): void {
    this.gamepad.onShift((direction) => {
      this.used.add('gamepad');
      listener(direction);
    });
  }

  update(dtMs: number): void {
    this.keyboard.update(dtMs);
    this.gamepad.update();
    this.tilt.update(dtMs);

    const pad = this.gamepad.getSteering();
    const padMoved = Math.abs(pad - this.lastGamepad) > CONFIG.mixer.INPUT_ACTIVITY_THRESHOLD;
    this.lastGamepad = pad;

    // Tilt is noisier than a wheel, so it needs a bigger, accumulated change to take over.
    const tilt = this.tilt.getSteering();
    const tiltMoved = Math.abs(tilt - this.tiltAnchor) > CONFIG.tilt.activityThreshold;
    if (tiltMoved) this.tiltAnchor = tilt;

    // Braking never steals steering, but it is still recorded as device use.
    if (this.keyboard.isBraking() || this.keyboard.isAccelerating()) this.used.add('keyboard');
    if (this.touchBrake.isBraking()) this.used.add('touch');
    if (this.gamepad.isBraking() || this.gamepad.isAccelerating()) this.used.add('gamepad');

    // Whichever device was touched most recently owns steering.
    if (this.keyboard.consumeKeyEvent() || this.keyboard.isHeld()) this.setSource('keyboard');
    else if (padMoved) this.setSource('gamepad');
    else if (tiltMoved) this.setSource('tilt');
    else if (this.source === 'none' && this.gamepad.getConnected()) this.source = 'gamepad';
  }

  /** True while the child holds a brake (key, pedal or touch zone). */
  isBraking(): boolean {
    return this.keyboard.isBraking() || this.touchBrake.isBraking() || this.gamepad.isBraking();
  }

  isAccelerating(): boolean {
    return this.keyboard.isAccelerating() || this.gamepad.isAccelerating();
  }

  getSpeedMultiplier(): number {
    return this.keyboard.isAccelerating() ? 3 : pedalSpeedMultiplier(this.gamepad.getThrottle());
  }

  getSteering(): number {
    switch (this.source) {
      case 'keyboard':
        return this.keyboard.getSteering();
      case 'gamepad':
        return this.gamepad.getSteering();
      case 'tilt':
        return this.tilt.getSteering();
      default:
        return 0;
    }
  }

  /**
   * A held steering key or brake is always deliberate, so it counts as activity even when
   * the value has stopped changing. Wheel and tilt activity are detected from changes only.
   */
  isHeldActive(): boolean {
    return (this.source === 'keyboard' && this.keyboard.isHeld()) || this.isBraking();
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
