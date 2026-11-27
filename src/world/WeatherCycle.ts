import type { WeatherPreset } from './presets/types';

export type WeatherPhase = 'clear' | 'rain' | 'rainbow';
export interface WeatherState { phase: WeatherPhase; rain: number; rainbow: number }

const smooth = (v: number): number => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};

/** Simulation-clock state machine; no wall timers and no events while paused. */
export class WeatherCycle {
  private phase: WeatherPhase = 'clear';
  private elapsed = 0;
  private duration: number;
  private first = true;

  constructor(private readonly preset: WeatherPreset, private readonly rng: () => number = Math.random) {
    this.duration = preset.firstRainSec;
  }

  reset(): void {
    this.phase = 'clear';
    this.elapsed = 0;
    this.duration = this.preset.firstRainSec;
    this.first = true;
  }

  update(dt: number): WeatherState {
    if (Number.isFinite(dt) && dt > 0) {
      this.elapsed += dt;
      while (this.elapsed >= this.duration) {
        this.elapsed -= this.duration;
        if (this.phase === 'clear') {
          this.phase = 'rain';
          this.duration = this.range(this.preset.rainDurationSec);
        } else if (this.phase === 'rain') {
          const rainbow = (this.first && this.preset.firstRainbow) || this.rng() < this.preset.rainbowChance;
          this.first = false;
          this.phase = rainbow ? 'rainbow' : 'clear';
          this.duration = rainbow ? this.preset.rainbowDurationSec : this.range(this.preset.clearIntervalSec);
        } else {
          this.phase = 'clear';
          this.duration = this.range(this.preset.clearIntervalSec);
        }
      }
    }
    const fade = Math.min(2, this.duration / 3);
    const intensity = smooth(Math.min(this.elapsed, this.duration - this.elapsed) / fade);
    return { phase: this.phase, rain: this.phase === 'rain' ? intensity : 0,
      rainbow: this.phase === 'rainbow' ? intensity : 0 };
  }

  private range([min, max]: [number, number]): number {
    return min + (max - min) * this.rng();
  }
}
