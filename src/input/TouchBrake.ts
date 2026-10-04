import { CONFIG } from '../game/config';

/**
 * One big brake target for tablets: pressing anywhere in the bottom part of the
 * game canvas brakes; lifting every finger releases. Multi-touch safe.
 * Deliberately not a virtual gamepad.
 */
export class TouchBrake {
  private readonly pointers = new Set<number>();
  private enabled = true;
  private listener: ((braking: boolean) => void) | null = null;
  private used = false;

  constructor(private readonly zone: number = CONFIG.touch.brakeZone) {}

  attach(target: HTMLElement): () => void {
    const down = (e: PointerEvent) => {
      if (!this.enabled || !isInZone(e, target, this.zone)) return;
      this.pointers.add(e.pointerId);
      this.used = true;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // Capture is best-effort.
      }
      this.emit();
    };
    const up = (e: PointerEvent) => {
      if (this.pointers.delete(e.pointerId)) this.emit();
    };
    const preventMenu = (e: Event) => e.preventDefault();
    target.addEventListener('pointerdown', down);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) target.addEventListener(type, up);
    target.addEventListener('contextmenu', preventMenu);
    return () => {
      target.removeEventListener('pointerdown', down);
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) target.removeEventListener(type, up);
      target.removeEventListener('contextmenu', preventMenu);
    };
  }

  /** Release everything (e.g. when the Parent Menu opens or the session ends). */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && this.pointers.size) {
      this.pointers.clear();
      this.emit();
    }
  }

  onChange(listener: (braking: boolean) => void): void {
    this.listener = listener;
  }

  isBraking(): boolean {
    return this.enabled && this.pointers.size > 0;
  }

  wasUsed(): boolean {
    return this.used;
  }

  private emit(): void {
    this.listener?.(this.isBraking());
  }
}

/** Pure helper: is the pointer inside the bottom brake zone of the element? */
export function isInZone(e: { clientY: number }, el: { getBoundingClientRect(): { top: number; height: number } }, zone: number): boolean {
  const rect = el.getBoundingClientRect();
  return e.clientY >= rect.top + rect.height * (1 - zone);
}
