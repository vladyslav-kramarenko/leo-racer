import type { AudioPreset } from '../world/presets/types';

/**
 * All sounds are synthesised with Web Audio — no audio files, no licensing questions.
 * Engine: two detuned oscillators through a low-pass filter.
 * Ambient: soft filtered noise plus occasional gentle construction "clinks".
 * Horn: a friendly two-tone beep.
 * Air brake: a short hiss of filtered white noise.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOsc: OscillatorNode[] = [];
  private engineGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private enabled = true;
  private ducked = false;
  private nextClink = 3;
  private hornUntil = 0;
  private baseHz = 52;
  private whiteNoise: AudioBuffer | null = null;

  /** Must be called from a user gesture (START DRIVING). */
  start(preset: AudioPreset): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
    } catch {
      this.ctx = null;
      return;
    }
    const ctx = this.ctx;
    this.baseHz = preset.engineBaseHz;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // Engine
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.11;
    filter.connect(this.engineGain).connect(this.master);
    for (const [type, mult, gain] of [
      ['sawtooth', 1, 0.5],
      ['square', 2.01, 0.18],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = this.baseHz * mult;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(g).connect(filter);
      osc.start();
      this.engineOsc.push(osc);
    }
    // Slow wobble for a chugging feel.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 7;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(this.engineGain.gain);
    lfo.start();

    // Ambient noise bed
    if (preset.ambient !== 'none') {
      const noise = ctx.createBufferSource();
      noise.buffer = createBrownNoise(ctx, 4);
      noise.loop = true;
      const nf = ctx.createBiquadFilter();
      nf.type = 'lowpass';
      nf.frequency.value = 700;
      this.ambientGain = ctx.createGain();
      this.ambientGain.gain.value = 0.05;
      noise.connect(nf).connect(this.ambientGain).connect(this.master);
      noise.start();
    }

    this.applyVolume();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.applyVolume();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Quieter while the parent menu is open. */
  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    this.applyVolume();
  }

  /** @param speedRatio 0 = stopped (idle), 1 = cruising. */
  update(dt: number, steering: number, speedRatio: number, running: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !running) return;
    const pitch = (0.72 + 0.28 * speedRatio) * (1 + Math.abs(steering) * 0.06);
    this.engineOsc.forEach((osc, i) => {
      osc.frequency.setTargetAtTime(this.baseHz * (i === 0 ? 1 : 2.01) * pitch, ctx.currentTime, 0.2);
    });

    if (this.ambientGain) {
      this.nextClink -= dt;
      if (this.nextClink <= 0) {
        this.clink();
        this.nextClink = 2.5 + Math.random() * 5;
      }
    }
  }

  horn(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.enabled) return;
    const now = ctx.currentTime;
    if (now < this.hornUntil) return;
    this.hornUntil = now + 0.55;
    for (const [start, freqs] of [
      [0, [392, 494]],
      [0.26, [392, 494]],
    ] as const) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + start);
      g.gain.linearRampToValueAtTime(0.16, now + start + 0.02);
      g.gain.setValueAtTime(0.16, now + start + 0.16);
      g.gain.linearRampToValueAtTime(0, now + start + 0.22);
      g.connect(this.master);
      for (const f of freqs) {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = f;
        const lp = ctx.createBiquadFilter();
        lp.frequency.value = 1800;
        osc.connect(lp).connect(g);
        osc.start(now + start);
        osc.stop(now + start + 0.25);
      }
    }
  }

  /** "Pssht!" — school-bus air brake. */
  airBrake(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.enabled) return;
    this.whiteNoise ??= createWhiteNoise(ctx, 1);
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.whiteNoise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(3200, now);
    band.frequency.exponentialRampToValueAtTime(1800, now + 0.6);
    band.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
    src.connect(band).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + 0.7);
  }

  private clink(): void {
    const ctx = this.ctx;
    if (!ctx || !this.ambientGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 900 + Math.random() * 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.25, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(g).connect(this.ambientGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  private applyVolume(): void {
    if (!this.ctx || !this.master) return;
    const target = this.enabled ? (this.ducked ? 0.25 : 1) : 0;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
  }
}

function createWhiteNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function createBrownNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}
