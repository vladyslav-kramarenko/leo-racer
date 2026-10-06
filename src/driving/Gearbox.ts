/** Ratios relative to the original cruising speed and engine pitch. */
export const GEARS = [
  { speed: 0.65, rpm: 1.45 },
  { speed: 0.85, rpm: 1.2 },
  { speed: 1, rpm: 1 },
  { speed: 1.2, rpm: 0.84 },
  { speed: 1.45, rpm: 0.72 },
] as const;

export class Gearbox {
  private index = 2;

  getGear(): number { return this.index + 1; }
  getRatios(): { speed: number; rpm: number } { return GEARS[this.index]; }

  shift(direction: -1 | 1): void {
    this.index = Math.max(0, Math.min(GEARS.length - 1, this.index + direction));
  }

  reset(): void { this.index = 2; }
}
