import { CONFIG } from '../game/config';
import { approach, type SteeringInput } from './SteeringState';

export interface KeyboardTiming {
  rampUpMs: number;
  returnMs: number;
}

/**
 * Pure virtual-steering model: holding a key ramps steering toward ±1,
 * releasing returns it to centre. Both keys together cancel out.
 */
export class KeyboardSteering implements SteeringInput {
  private value = 0;
  private left = false;
  private right = false;

  constructor(private readonly timing: KeyboardTiming = CONFIG.keyboard) {}

  setKeys(left: boolean, right: boolean): void {
    this.left = left;
    this.right = right;
  }

  /** True while a steering key is physically held. */
  isHeld(): boolean {
    return this.left !== this.right;
  }

  update(dtMs: number): void {
    const target = (this.right ? 1 : 0) - (this.left ? 1 : 0);
    // Moving across centre (e.g. left → right) uses the ramp speed for the whole way.
    const duration = target === 0 ? this.timing.returnMs : this.timing.rampUpMs;
    this.value = approach(this.value, target, dtMs / Math.max(1, duration));
  }

  getSteering(): number {
    return this.value;
  }

  reset(): void {
    this.value = 0;
    this.left = this.right = false;
  }
}

const LEFT_CODES = new Set(['ArrowLeft', 'KeyA']);
const RIGHT_CODES = new Set(['ArrowRight', 'KeyD']);
const BRAKE_CODES = new Set(['ArrowDown', 'KeyS']);
const THROTTLE_CODES = new Set(['ArrowUp', 'KeyW']);
const HORN_CODES = new Set(['Space', 'KeyH']);

/** Binds DOM keyboard events to a KeyboardSteering model. */
export class KeyboardInput implements SteeringInput {
  readonly steering: KeyboardSteering;
  private readonly pressed = new Set<string>();
  private hornListener: ((variant: number) => void) | null = null;
  /** Set whenever a steering key goes down; consumed by InputManager. */
  private keyEvent = false;

  constructor(timing?: KeyboardTiming) {
    this.steering = new KeyboardSteering(timing);
  }

  attach(target: Window = window): () => void {
    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (LEFT_CODES.has(e.code) || RIGHT_CODES.has(e.code)) {
        e.preventDefault();
        if (!e.repeat) this.keyEvent = true;
        this.pressed.add(e.code);
        this.sync();
      } else if (BRAKE_CODES.has(e.code) || THROTTLE_CODES.has(e.code)) {
        e.preventDefault();
        this.pressed.add(e.code);
      } else if (HORN_CODES.has(e.code) || /^(Digit|Numpad)[1-6]$/.test(e.code)) {
        e.preventDefault();
        if (!e.repeat) this.hornListener?.(HORN_CODES.has(e.code) ? 0 : Number(e.code.slice(-1)) - 1);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (this.pressed.delete(e.code)) this.sync();
    };
    const blur = () => {
      this.pressed.clear();
      this.sync();
    };
    target.addEventListener('keydown', down);
    target.addEventListener('keyup', up);
    target.addEventListener('blur', blur);
    return () => {
      target.removeEventListener('keydown', down);
      target.removeEventListener('keyup', up);
      target.removeEventListener('blur', blur);
    };
  }

  onHorn(listener: (variant: number) => void): void {
    this.hornListener = listener;
  }

  consumeKeyEvent(): boolean {
    const had = this.keyEvent;
    this.keyEvent = false;
    return had;
  }

  update(dtMs: number): void {
    this.steering.update(dtMs);
  }

  isHeld(): boolean {
    return this.steering.isHeld();
  }

  isBraking(): boolean {
    return [...BRAKE_CODES].some((c) => this.pressed.has(c));
  }

  isAccelerating(): boolean {
    return [...THROTTLE_CODES].some((c) => this.pressed.has(c));
  }

  getSteering(): number {
    return this.steering.getSteering();
  }

  private sync(): void {
    const left = [...LEFT_CODES].some((c) => this.pressed.has(c));
    const right = [...RIGHT_CODES].some((c) => this.pressed.has(c));
    this.steering.setKeys(left, right);
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
