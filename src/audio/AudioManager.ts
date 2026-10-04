import type { AmbientEvent, AudioPreset } from '../world/presets/types';

/**
 * All sounds are synthesised with Web Audio — no audio files, no licensing questions.
 * Engine: two detuned oscillators through a low-pass filter.
 * Ambience: a filtered noise bed plus occasional events chosen by the world preset
 * (construction clinks, birds, cows, waves, distant honks, bicycle bells, seagulls).
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
  private nextEvent = 3;
  private events: AmbientEvent[] = [];
  private eventInterval: [number, number] = [3, 8];
  private hornUntil = 0;
  private baseHz = 52;
  private whiteNoise: AudioBuffer | null = null;
  private waveNoise: AudioBuffer | null = null;

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

    // Ambience: noise bed (optionally swelling like waves) + preset events.
    const amb = preset.ambience;
    this.events = [...amb.events];
    this.eventInterval = amb.eventInterval;
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 1;
    this.ambientGain.connect(this.master);
    if (amb.noiseLevel > 0) {
      const noise = ctx.createBufferSource();
      noise.buffer = createBrownNoise(ctx, 4);
      noise.loop = true;
      const nf = ctx.createBiquadFilter();
      nf.type = 'lowpass';
      nf.frequency.value = amb.noiseCutoff;
      const bed = ctx.createGain();
      bed.gain.value = amb.noiseLevel;
      noise.connect(nf).connect(bed).connect(this.ambientGain);
      if (amb.noiseSwellHz) {
        const swell = ctx.createOscillator();
        swell.frequency.value = amb.noiseSwellHz;
        const depth = ctx.createGain();
        depth.gain.value = amb.noiseLevel * 0.8;
        swell.connect(depth).connect(bed.gain);
        swell.start();
      }
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

    if (this.events.length) {
      this.nextEvent -= dt;
      if (this.nextEvent <= 0) {
        this.playEvent(this.events[Math.floor(Math.random() * this.events.length)]);
        const [min, max] = this.eventInterval;
        this.nextEvent = min + Math.random() * (max - min);
      }
    }
  }

  /** 0 = engine silent (bus parked at the end of a session), 1 = normal. */
  setEngineLevel(level: number): void {
    if (!this.ctx || !this.engineGain) return;
    this.engineGain.gain.setTargetAtTime(0.11 * Math.max(0, Math.min(1, level)), this.ctx.currentTime, 0.6);
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

  private playEvent(event: AmbientEvent): void {
    const ctx = this.ctx;
    const out = this.ambientGain;
    if (!ctx || !out) return;
    const now = ctx.currentTime;
    switch (event) {
      case 'clink':
        tone(ctx, out, now, 'triangle', [900 + Math.random() * 900], 0.25, 0.005, 0.35);
        break;
      case 'chirp': {
        // Two or three quick upward sweeps — a small bird.
        const notes = 2 + Math.floor(Math.random() * 2);
        const base = 2600 + Math.random() * 900;
        for (let i = 0; i < notes; i++) {
          const t = now + i * 0.13;
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(base, t);
          osc.frequency.exponentialRampToValueAtTime(base * 1.45, t + 0.08);
          envelope(ctx, osc, out, t, 0.07, 0.01, 0.09);
        }
        break;
      }
      case 'moo': {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.linearRampToValueAtTime(105, now + 1.1);
        const formant = ctx.createBiquadFilter();
        formant.type = 'lowpass';
        formant.frequency.setValueAtTime(500, now);
        formant.frequency.linearRampToValueAtTime(800, now + 0.4);
        formant.frequency.linearRampToValueAtTime(400, now + 1.1);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.12, now + 0.15);
        g.gain.setValueAtTime(0.12, now + 0.8);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
        osc.connect(formant).connect(g).connect(out);
        osc.start(now);
        osc.stop(now + 1.25);
        break;
      }
      case 'wave': {
        this.waveNoise ??= createBrownNoise(ctx, 2.5);
        const src = ctx.createBufferSource();
        src.buffer = this.waveNoise;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 900;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.18, now + 0.9);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
        src.connect(f).connect(g).connect(out);
        src.start(now);
        src.stop(now + 2.5);
        break;
      }
      case 'honk':
        // Distant, soft car horn.
        tone(ctx, out, now, 'square', [330, 415], 0.03, 0.02, 0.3, 900);
        break;
      case 'gull': {
        // Seagull: two quick rising-then-falling "kee-ow" calls.
        for (let i = 0; i < 2; i++) {
          const t = now + i * 0.32;
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1500, t);
          osc.frequency.linearRampToValueAtTime(2300, t + 0.07);
          osc.frequency.exponentialRampToValueAtTime(1100, t + 0.26);
          envelope(ctx, osc, out, t, 0.05, 0.02, 0.26);
        }
        break;
      }
      case 'bell':
        tone(ctx, out, now, 'sine', [2100, 2650], 0.06, 0.003, 0.7);
        tone(ctx, out, now + 0.18, 'sine', [2100, 2650], 0.05, 0.003, 0.6);
        break;
    }
  }

  private applyVolume(): void {
    if (!this.ctx || !this.master) return;
    const target = this.enabled ? (this.ducked ? 0.25 : 1) : 0;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
  }
}

/** Short tone (one or more partials) with a percussive envelope. */
function tone(
  ctx: AudioContext,
  out: AudioNode,
  at: number,
  type: OscillatorType,
  freqs: number[],
  peak: number,
  attack: number,
  decay: number,
  lowpass?: number,
): void {
  for (const f of freqs) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = f;
    let node: AudioNode = osc;
    if (lowpass) {
      const lp = ctx.createBiquadFilter();
      lp.frequency.value = lowpass;
      node = node.connect(lp);
    }
    envelope(ctx, osc, out, at, peak / freqs.length, attack, decay, node);
  }
}

function envelope(
  ctx: AudioContext,
  osc: OscillatorNode,
  out: AudioNode,
  at: number,
  peak: number,
  attack: number,
  decay: number,
  from: AudioNode = osc,
): void {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  from.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + attack + decay + 0.05);
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
