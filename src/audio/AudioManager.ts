import type { AmbientEvent, AudioPreset } from '../world/presets/types';
import { DEFAULT_HORN, HORNS, normalizeHorn } from './horns';
import { createCubRoar, createTrainChuff, createTrainWhistle, createSantaLaugh, distanceGain } from './characterSounds';

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
  private rainGain: GainNode | null = null;
  private rainLevel = 0;
  private enabled = true;
  private ducked = false;
  private nextEvent = 3;
  private events: AmbientEvent[] = [];
  private eventInterval: [number, number] = [3, 8];
  private hornUntil = Array<number>(HORNS.length).fill(0);
  private zoomUntil = 0;
  private roarUntil = 0;
  private roarBuffer: AudioBuffer | null = null;
  private trainGain: GainNode | null = null;
  private trainLevel = 0;
  private trainWhistled = false;
  private trainWhistleBuffer: AudioBuffer | null = null;
  private santaGain: GainNode | null = null;
  private santaLevel = 0;
  private santaGreeted = false;
  private santaBuffer: AudioBuffer | null = null;
  private baseHz = 52;
  private whiteNoise: AudioBuffer | null = null;
  private waveNoise: AudioBuffer | null = null;

  /** Unlock only the audio output on a user gesture; no engine or ambience yet. */
  private unlock(): AudioContext | null {
    if (!this.ctx) {
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return null;
        const ctx = new Ctx();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = 0;
        this.master.connect(ctx.destination);
        this.applyVolume();
      } catch {
        this.ctx = null;
        this.master = null;
        return null;
      }
    }
    void this.ctx.resume().catch(() => { /* Audio may be blocked by the browser. */ });
    return this.ctx;
  }

  /** A soft vocal-style cub roar, generated once and reused. */
  mascotRoar(): void {
    if (!this.enabled) return;
    const ctx = this.unlock();
    if (!ctx || !this.master || ctx.currentTime < this.roarUntil) return;
    this.roarBuffer ??= this.makeSound(ctx, createCubRoar);
    this.roarUntil = ctx.currentTime + this.roarBuffer.duration + 0.1;
    const gain = ctx.createGain();
    gain.gain.value = 0.34;
    gain.connect(this.master);
    const source = this.playBuffer(ctx, this.roarBuffer, gain);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
  }

  /** Distance-based train exhaust plus one double whistle per passing locomotive. */
  setTrainSound(distance: number, active: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    if (!Number.isFinite(distance)) this.trainWhistled = false;
    const level = active ? distanceGain(distance, 12, 115) * 0.42 : 0;
    if (!this.trainGain && level > 0) {
      this.trainGain = ctx.createGain();
      this.trainGain.gain.value = 0;
      this.trainGain.connect(this.master);
      const loop = ctx.createBufferSource();
      loop.buffer = this.makeSound(ctx, createTrainChuff);
      loop.loop = true;
      // Keep the double whistle at its original level; soften only the steam rhythm.
      const chuffGain = ctx.createGain();
      chuffGain.gain.value = 0.8;
      loop.connect(chuffGain).connect(this.trainGain);
      loop.start();
    }
    if (this.trainGain) {
      if (Math.abs(level - this.trainLevel) > 0.005 || (level === 0 && this.trainLevel !== 0)) {
        this.trainLevel = level;
        this.trainGain.gain.setTargetAtTime(level, ctx.currentTime, 0.14);
      }
      if (active && this.enabled && !this.trainWhistled && distance < 68) {
        this.trainWhistled = true;
        this.trainWhistleBuffer ??= this.makeSound(ctx, createTrainWhistle);
        const source = this.playBuffer(ctx, this.trainWhistleBuffer, this.trainGain);
        source.onended = () => source.disconnect();
      }
    }
  }

  /** Santa's greeting once per flypast; distance and pause both control volume. */
  setSantaSound(distance: number, active: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    if (!Number.isFinite(distance)) this.santaGreeted = false;
    const level = active ? distanceGain(distance, 25, 190) * 0.43 : 0;
    if (!this.santaGain && level > 0) {
      this.santaGain = ctx.createGain();
      this.santaGain.gain.value = 0;
      this.santaGain.connect(this.master);
    }
    if (this.santaGain) {
      if (Math.abs(level - this.santaLevel) > 0.005 || (level === 0 && this.santaLevel !== 0)) {
        this.santaLevel = level;
        this.santaGain.gain.setTargetAtTime(level, ctx.currentTime, 0.12);
      }
      if (active && this.enabled && !this.santaGreeted && distance < 145) {
        this.santaGreeted = true;
        this.santaBuffer ??= this.makeSound(ctx, createSantaLaugh);
        const source = this.playBuffer(ctx, this.santaBuffer, this.santaGain);
        source.onended = () => source.disconnect();
      }
    }
  }

  private makeSound(ctx: AudioContext, generate: (rate: number) => Float32Array): AudioBuffer {
    const samples = generate(ctx.sampleRate);
    const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.getChannelData(0).set(samples);
    return buffer;
  }

  private playBuffer(ctx: AudioContext, buffer: AudioBuffer, output: AudioNode): AudioBufferSourceNode {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(output);
    source.start();
    return source;
  }

  /** Must be called from a user gesture (START DRIVING). */
  start(preset: AudioPreset): void {
    const ctx = this.unlock();
    if (!ctx || !this.master || this.engineOsc.length) return;
    this.baseHz = preset.engineBaseHz;

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

  /** A soft filtered shower; lazy loop, silence outside rain and while paused. */
  setRainLevel(level: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const target = Math.max(0, Math.min(1, level));
    if (!this.rainGain && target > 0) {
      this.whiteNoise ??= createWhiteNoise(ctx, 1);
      const source = ctx.createBufferSource();
      source.buffer = this.whiteNoise;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1150;
      filter.Q.value = 0.45;
      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = 0;
      source.connect(filter).connect(this.rainGain).connect(this.master);
      source.start();
    }
    if (this.rainGain && Math.abs(target - this.rainLevel) > 0.005) {
      this.rainLevel = target;
      this.rainGain.gain.setTargetAtTime(target * 0.052, ctx.currentTime, 0.12);
    } else if (this.rainGain && target === 0 && this.rainLevel !== 0) {
      this.rainLevel = 0;
      this.rainGain.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
    }
  }

  /** 0 = engine silent (bus parked at the end of a session), 1 = normal. */
  setEngineLevel(level: number): void {
    if (!this.ctx || !this.engineGain) return;
    this.engineGain.gain.setTargetAtTime(ENGINE_GAIN * Math.max(0, Math.min(1, level)), this.ctx.currentTime, 0.6);
  }

  horn(variant = DEFAULT_HORN): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.enabled) return;
    const now = ctx.currentTime;
    const index = normalizeHorn(variant);
    if (now < this.hornUntil[index]) return;
    const sound = HORNS[index];
    const hold = 'hold' in sound ? sound.hold : 0;
    const attack = 'attack' in sound ? sound.attack : 0.015;
    this.hornUntil[index] = now + (sound.notes.length - 1) * sound.spacing + attack + hold + sound.decay + 0.05;
    sound.notes.forEach((freqs, note) => {
      tone(ctx, this.master!, now + note * sound.spacing, sound.type, [...freqs], 0.22, attack, sound.decay, sound.cutoff, hold);
    });
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
  hold = 0,
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
    envelope(ctx, osc, out, at, peak / freqs.length, attack, decay, node, hold);
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
  hold = 0,
): void {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  if (hold > 0) g.gain.setValueAtTime(Math.max(0.0002, peak), at + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + decay);
  from.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + attack + hold + decay + 0.05);
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
