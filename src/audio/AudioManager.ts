import type { AmbientEvent, AudioPreset } from '../world/presets/types';

/** Engine loudness at cruise. Kept low so the bus hums gently instead of droning. */
const ENGINE_GAIN = 0.055;

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
  private engineRevGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private accelerationOsc: OscillatorNode | null = null;
  private accelerationGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private enabled = true;
  private ducked = false;
  private nextEvent = 3;
  private events: AmbientEvent[] = [];
  private eventInterval: [number, number] = [3, 8];
  private hornUntil = 0;
  private zoomUntil = 0;
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

    // Engine: soft and low — present, but not a drone. Oscillators → low-pass → gentle
    // "chug" (pulse, multiplied) → level (so a parked bus is truly silent).
    const filter = ctx.createBiquadFilter();
    this.engineFilter = filter;
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    const pulse = ctx.createGain();
    pulse.gain.value = 1;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = ENGINE_GAIN;
    // A separate rev level keeps accelerator feedback independent of the session fade.
    this.engineRevGain = ctx.createGain();
    this.engineRevGain.gain.value = 1;
    filter.connect(pulse).connect(this.engineRevGain).connect(this.engineGain).connect(this.master);
    for (const [type, mult, gain] of [
      ['sawtooth', 1, 0.5],
      ['square', 2.01, 0.07],
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
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 6;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.12;
    lfo.connect(lfoGain).connect(pulse.gain);
    lfo.start();

    // A distinct midrange motor voice makes pressing the accelerator clearly audible.
    // It shares the engine's final level so session fade and parking silence still apply.
    this.accelerationOsc = ctx.createOscillator();
    this.accelerationOsc.type = 'triangle';
    this.accelerationOsc.frequency.value = 85;
    const revFilter = ctx.createBiquadFilter();
    revFilter.type = 'lowpass';
    revFilter.frequency.value = 1100;
    this.accelerationGain = ctx.createGain();
    this.accelerationGain.gain.value = 0;
    this.accelerationOsc.connect(revFilter).connect(this.accelerationGain).connect(this.engineGain);
    this.accelerationOsc.start();

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

  /** Accelerator feedback starts on press, before the vehicle has gained speed. */
  update(dt: number, steering: number, speedRatio: number, running: boolean, speedMultiplier = 1, rpmMultiplier = 1): void {
    const ctx = this.ctx;
    if (!ctx || !running) return;
    const boost = Number.isFinite(speedMultiplier) ? Math.max(0, Math.min(1, (speedMultiplier - 1) / 2)) : 0;
    // Even a light pedal press is audible; full pedal or ↑/W gives the strongest rev.
    const rev = boost > 0 ? 0.55 + 0.45 * boost : 0;
    const response = rev > 0 ? 0.07 : 0.3;
    const speed = Number.isFinite(speedRatio) ? Math.max(0, Math.min(5, speedRatio)) : 1;
    const rpm = Number.isFinite(rpmMultiplier) ? Math.max(0.5, Math.min(2, rpmMultiplier)) : 1;
    const pitch = (0.72 + 0.28 * speed) * (1 + Math.abs(steering) * 0.06) * (1 + rev) * rpm;
    this.engineOsc.forEach((osc, i) => {
      osc.frequency.setTargetAtTime(this.baseHz * (i === 0 ? 1 : 2.01) * pitch, ctx.currentTime, response);
    });
    this.engineRevGain?.gain.setTargetAtTime(1 + rev * 2, ctx.currentTime, response);
    this.engineFilter?.frequency.setTargetAtTime(300 + rev * 1000, ctx.currentTime, response);
    this.accelerationOsc?.frequency.setTargetAtTime((85 + rev * 155 + speed * 20) * rpm, ctx.currentTime, 0.18);
    this.accelerationGain?.gain.setTargetAtTime(rev * 1.3, ctx.currentTime, response);

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
    this.engineGain.gain.setTargetAtTime(ENGINE_GAIN * Math.max(0, Math.min(1, level)), this.ctx.currentTime, 0.6);
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

  /**
   * A fast car going past: a soft, low "vrooom" that swells in and fades out.
   * Deliberately gentle — no buzzy waveform, no sharp attack, quieter than the horn.
   */
  zoom(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.enabled) return;
    const now = ctx.currentTime;
    if (now < this.zoomUntil) return;
    this.zoomUntil = now + 3;

    // Low engine hum sliding down (a hint of Doppler), heavily filtered.
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(92, now + 1.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.035, now + 0.45);
    g.gain.linearRampToValueAtTime(0, now + 1.5);
    osc.connect(lp).connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 1.55);

    // Soft rumble of air (brown noise is much gentler than white noise).
    this.waveNoise ??= createBrownNoise(ctx, 2.5);
    const noise = ctx.createBufferSource();
    noise.buffer = this.waveNoise;
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.setValueAtTime(900, now);
    nf.frequency.linearRampToValueAtTime(380, now + 1.4);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, now);
    ng.gain.linearRampToValueAtTime(0.06, now + 0.5);
    ng.gain.linearRampToValueAtTime(0, now + 1.45);
    noise.connect(nf).connect(ng).connect(this.master);
    noise.start(now);
    noise.stop(now + 1.5);
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
        // A small bird far away: two or three short trills (fast vibrato), soft and not too high.
        const notes = 2 + Math.floor(Math.random() * 2);
        const base = 1700 + Math.random() * 500;
        for (let i = 0; i < notes; i++) {
          const t = now + i * 0.16;
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(base, t);
          osc.frequency.linearRampToValueAtTime(base * 1.18, t + 0.1);
          const trill = ctx.createOscillator();
          trill.frequency.value = 28 + Math.random() * 10;
          const depth = ctx.createGain();
          depth.gain.value = base * 0.06;
          trill.connect(depth).connect(osc.frequency);
          trill.start(t);
          trill.stop(t + 0.16);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.03, t + 0.03);
          g.gain.linearRampToValueAtTime(0, t + 0.13);
          osc.connect(g).connect(out);
          osc.start(t);
          osc.stop(t + 0.15);
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
        // Distant seagull: two soft "kee-ow" calls, lower and gentler than before.
        for (let i = 0; i < 2; i++) {
          const t = now + i * 0.36;
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1050, t);
          osc.frequency.linearRampToValueAtTime(1500, t + 0.08);
          osc.frequency.exponentialRampToValueAtTime(800, t + 0.3);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.028, t + 0.05);
          g.gain.linearRampToValueAtTime(0, t + 0.3);
          osc.connect(g).connect(out);
          osc.start(t);
          osc.stop(t + 0.32);
        }
        break;
      }
      case 'bell':
        tone(ctx, out, now, 'sine', [1500, 1890], 0.035, 0.005, 0.6);
        tone(ctx, out, now + 0.2, 'sine', [1500, 1890], 0.03, 0.005, 0.5);
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
