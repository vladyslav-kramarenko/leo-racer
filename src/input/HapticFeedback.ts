import { CONFIG } from '../game/config';
import { clamp } from './SteeringState';

export interface HapticActuator extends Pick<GamepadHapticActuator, 'playEffect' | 'reset'> {
  readonly effects?: readonly GamepadHapticEffectType[];
}

/** Browser rumble only: directional wheel torque requires a native driver bridge. */
export class HapticFeedback {
  private active = true;
  private lastImpact = -Infinity;
  private lastEdge = -Infinity;
  private failed: HapticActuator | null = null;

  constructor(private readonly actuator: () => HapticActuator | null) {}

  getStatus(): 'available' | 'unsupported' | 'unavailable' {
    const actuator = this.actuator();
    if (!actuator || typeof actuator.playEffect !== 'function'
      || (actuator.effects && !actuator.effects.includes('dual-rumble'))) return 'unsupported';
    return actuator === this.failed ? 'unavailable' : 'available';
  }

  impact(now: number): void {
    if (now - this.lastImpact < 300) return;
    if (this.play(180, 0.35, 0.55)) this.lastImpact = now;
  }

  roadEdge(now: number, strength: number): void {
    if (!Number.isFinite(strength) || strength <= 0 || now - this.lastImpact < 250 || now - this.lastEdge < 350) return;
    const amount = clamp(strength, 0, 1);
    if (this.play(100, 0.08 + amount * 0.12, 0.12 + amount * 0.18)) this.lastEdge = now;
  }

  stop(): void {
    const actuator = this.actuator();
    try {
      if (typeof actuator?.reset === 'function') void actuator.reset().catch(() => {});
    } catch {
      // Disconnection or an unsupported reset must not interrupt driving.
    }
    this.lastImpact = this.lastEdge = -Infinity;
    this.failed = null;
  }

  attach(target: Window = window, doc: Document = document): () => void {
    const setActive = (active: boolean) => {
      this.active = active;
      if (!active) this.stop();
    };
    const blur = () => setActive(false);
    const focus = () => setActive(!doc.hidden);
    const visibility = () => setActive(!doc.hidden && doc.hasFocus());
    target.addEventListener('blur', blur);
    target.addEventListener('focus', focus);
    doc.addEventListener('visibilitychange', visibility);
    visibility();
    return () => {
      target.removeEventListener('blur', blur);
      target.removeEventListener('focus', focus);
      doc.removeEventListener('visibilitychange', visibility);
      setActive(false);
    };
  }

  private play(duration: number, strongMagnitude: number, weakMagnitude: number): boolean {
    if (!this.active || this.getStatus() !== 'available') return false;
    const actuator = this.actuator()!;
    try {
      void actuator.playEffect('dual-rumble', { duration, startDelay: 0, strongMagnitude, weakMagnitude })
        .catch(() => { this.failed = actuator; });
      return true;
    } catch {
      this.failed = actuator;
      return false;
    }
  }
}

/** Only intentional outward steering while moving triggers the roadside rumble. */
export function roadEdgeStrength(offset: number, steering: number, speed: number): number {
  if (![offset, steering, speed].every(Number.isFinite) || speed <= 0.1
    || Math.abs(offset) < CONFIG.driving.softLimit || steering * Math.sign(offset) <= 0.1) return 0;
  const depth = (Math.abs(offset) - CONFIG.driving.softLimit) / (CONFIG.driving.hardLimit - CONFIG.driving.softLimit);
  return 0.25 + 0.75 * clamp(depth, 0, 1);
}
