/** Original procedural effects, generated once on demand. No recordings or downloads. */
export const CUB_ROAR_SECONDS = 0.82;
export const TRAIN_CHUFF_SECONDS = 1.2;
export const TRAIN_WHISTLE_SECONDS = 1.65;
export const SANTA_LAUGH_SECONDS = 1.55;

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };
const tau = Math.PI * 2;

function noiseGenerator(seed: number): () => number {
  let x = seed | 0;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (x >>> 0) / 2147483648 - 1;
  };
}

function resonator(rate: number, hz: number, bandwidth: number): (input: number) => number {
  const r = Math.exp(-Math.PI * bandwidth / rate);
  const a = 2 * r * Math.cos(tau * hz / rate);
  let y1 = 0, y2 = 0;
  return (input) => {
    const y = (1 - r) * input + a * y1 - r * r * y2;
    y2 = y1; y1 = y;
    return y;
  };
}

function normalize(samples: Float32Array, peak: number): Float32Array {
  let max = 0;
  for (const v of samples) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < samples.length; i++) samples[i] *= peak / max;
  return samples;
}

/** Breathy onset, rough vocal pulses, open vowel and softer rounded ending.
 * Formants and irregular rasp replace the previous low buzzing sawtooth. */
export function createCubRoar(rate: number): Float32Array {
  const samples = new Float32Array(Math.round(rate * CUB_ROAR_SECONDS));
  const noise = noiseGenerator(751);
  const throat = resonator(rate, 740, 230);
  const mouth = resonator(rate, 1360, 360);
  const rounded = resonator(rate, 510, 180);
  const rasp = resonator(rate, 2450, 1000);
  let phase = 0, previous = 0, slow = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate;
    const n = noise();
    slow += (n - slow) * 0.018;
    const pitch = (315 + 48 * smooth(t / 0.18) - 115 * smooth((t - 0.26) / 0.5)) *
      (1 + 0.045 * Math.sin(t * tau * 31) + 0.18 * slow);
    phase = (phase + pitch / rate) % 1;
    const pulse = Math.pow(Math.sin(Math.PI * phase), 3);
    const glottal = pulse - previous;
    previous = pulse;
    const rough = glottal * 5 * (1 + 0.28 * Math.sin(t * tau * 43)) + n * (0.24 + pulse * 0.42);
    const open = smooth(t / 0.15) * (1 - smooth((t - 0.44) / 0.32));
    const voice = throat(rough) * (0.6 + open * 0.4) + mouth(rough) * open * 0.65 +
      rounded(rough) * (1 - open) * 0.4 + rasp(n) * 0.16;
    const env = smooth(t / 0.065) * (1 - smooth((t - 0.47) / 0.35));
    samples[i] = Math.tanh(voice * 1.1) * env;
  }
  return normalize(samples, 0.64);
}

/** Four gentle, alternating steam exhaust bursts per loop. */
export function createTrainChuff(rate: number): Float32Array {
  const samples = new Float32Array(Math.round(rate * TRAIN_CHUFF_SECONDS));
  const noise = noiseGenerator(547);
  const steam = resonator(rate, 710, 850);
  const grit = resonator(rate, 1750, 1300);
  let low = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate;
    const beat = Math.floor(t / 0.3);
    const age = t - beat * 0.3;
    const env = smooth(age / 0.025) * Math.exp(-age * 14) * (1 - smooth((age - 0.20) / 0.10));
    const n = noise();
    low += (n - low) * 0.035;
    const exhaust = steam(n) * 0.65 + grit(n) * 0.17 + low * 0.7;
    const clack = Math.sin(tau * 280 * age) * Math.exp(-age * 75) * 0.06;
    samples[i] = (exhaust + clack) * env * (beat % 2 ? 0.76 : 1);
  }
  return normalize(samples, 0.48);
}

/** Two breathy multi-chime steam whistle notes: short then long. */
export function createTrainWhistle(rate: number): Float32Array {
  const samples = new Float32Array(Math.round(rate * TRAIN_WHISTLE_SECONDS));
  const noise = noiseGenerator(932);
  const breath = resonator(rate, 1450, 1250);
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate;
    const start = t < 0.65 ? 0 : 0.65;
    const age = t - start;
    const duration = start === 0 ? 0.43 : 0.88;
    if (age >= duration) continue;
    const env = smooth(age / 0.06) * (1 - smooth((age - duration + 0.17) / 0.17));
    const glide = 1 - 0.07 * Math.exp(-age * 20);
    const p = tau * age * glide;
    const chimes = Math.sin(p * 392) * 0.55 + Math.sin(p * 494) * 0.35 +
      Math.sin(p * 587) * 0.25 + Math.sin(p * 784) * 0.09;
    samples[i] = (chimes * (0.94 + 0.06 * Math.sin(tau * 7 * age)) + breath(noise()) * 0.06) * env;
  }
  return normalize(samples, 0.75);
}

/** Three individually articulated "ho" syllables with rounded vowel formants. */
export function createSantaLaugh(rate: number): Float32Array {
  const samples = new Float32Array(Math.round(rate * SANTA_LAUGH_SECONDS));
  const noise = noiseGenerator(369);
  const f1 = resonator(rate, 460, 120);
  const f2 = resonator(rate, 870, 150);
  const f3 = resonator(rate, 2500, 400);
  const airy = resonator(rate, 1700, 1400);
  let phase = 0, prev = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate;
    const syllable = Math.min(2, Math.floor(t / 0.46));
    const age = t - syllable * 0.46;
    const duration = syllable === 2 ? 0.55 : 0.35;
    const n = noise();
    const pitch = [177, 166, 150][syllable] + 20 * Math.sin(Math.PI * clamp(age / duration)) - 26 * smooth(age / duration);
    phase = (phase + pitch / rate) % 1;
    const pulse = Math.pow(Math.sin(Math.PI * phase), 3);
    const glottal = (pulse - prev) * 7;
    prev = pulse;
    const voicing = smooth((age - 0.045) / 0.055);
    const aspiration = airy(n) * 0.3 * (1 - voicing);
    const voice = f1(glottal) * 0.7 + f2(glottal) * 0.48 + f3(glottal) * 0.1;
    const env = smooth(age / 0.035) * (1 - smooth((age - duration + 0.1) / 0.1));
    samples[i] = (aspiration + voice * voicing * (0.9 + 0.1 * Math.sin(tau * age * 19))) * env;
  }
  return normalize(samples, 0.7);
}

/** Smooth audibility: full nearby, silent at the outer radius. */
export function distanceGain(distance: number, near: number, far: number): number {
  return 1 - smooth((distance - near) / (far - near));
}
