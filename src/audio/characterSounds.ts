/** Original procedural effects, generated once on demand. No recordings or downloads. */
export const CUB_ROAR_SECONDS = 0.68;
export const TRAIN_CHUFF_SECONDS = 1.2;
export const TRAIN_WHISTLE_SECONDS = 1.65;
export const SANTA_MAGIC_SECONDS = 1.65;

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

/** Playful little "rrr-RAOW": a short purr-like onset opens into a smiling
 * voiced vowel, then rounds off. Mostly pitched, not the broadband rasp of an adult lion. */
export function createCubRoar(rate: number): Float32Array {
  const samples = new Float32Array(Math.round(rate * CUB_ROAR_SECONDS));
  const noise = noiseGenerator(751);
  const breathFilter = resonator(rate, 1800, 1100);
  let phase = 0;
  const bell = (x: number, center: number, width: number) =>
    Math.exp(-0.5 * ((x - center) / width) ** 2);
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate;
    const opening = smooth((t - 0.07) / 0.19);
    const rounding = smooth((t - 0.36) / 0.24);
    const purr = 1 - smooth(t / 0.20);
    // A small rising greeting, then a warm, rounded falling "ow".
    const pitch = 290 + 110 * smooth(t / 0.25) - 88 * smooth((t - 0.33) / 0.35);
    phase += tau * pitch * (1 + 0.009 * Math.sin(tau * 6.5 * t) + purr * 0.016 * Math.sin(tau * 27 * t)) / rate;
    const f1 = 620 + opening * 300 - rounding * 380;
    const f2 = 1420 + opening * 270 - rounding * 560;
    let voice = 0;
    // Gentle vocal harmonics, not a sawtooth. The vowel changes continuously.
    for (let k = 1; k <= 10; k++) {
      const hz = k * pitch;
      const weight = (0.16 + 0.85 * bell(hz, f1, 250) +
        0.50 * bell(hz, f2, 370) + 0.12 * bell(hz, 2600, 550)) / Math.pow(k, 0.85);
      voice += Math.sin(k * phase) * weight;
    }
    const trill = 1 - purr * 0.16 * (0.5 + 0.5 * Math.sin(tau * 29 * t));
    const breath = breathFilter(noise()) * (0.026 + purr * 0.045);
    const env = smooth(t / 0.065) * (0.58 + 0.42 * opening) * (1 - smooth((t - 0.43) / 0.25));
    samples[i] = (voice * trill + breath) * env;
  }
  return normalize(samples, 0.58);
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

/** A longer magical sweep: an original celesta-like ascending cascade with
 * a gentle glassy tail and sparse delayed reflections. No noise or sharp attacks. */
export function createSantaMagic(rate: number): Float32Array {
  const samples = new Float32Array(Math.round(rate * SANTA_MAGIC_SECONDS));
  // Fourteen notes over a little more than one second, then space for the resonance.
  const notes = [523.25, 659.25, 783.99, 880, 1046.50, 1174.66, 1318.51,
    1567.98, 1760, 2093, 2349.32, 2637.02, 3135.96, 3520];
  const starts = [0, 0.105, 0.205, 0.30, 0.39, 0.48, 0.565, 0.645, 0.725,
    0.80, 0.875, 0.95, 1.025, 1.10];
  const strike = (age: number, pitch: number): number => {
    if (age < 0 || age > 0.9) return 0;
    const p = tau * pitch * age;
    const attack = smooth(age / 0.025);
    const tail = 1 - smooth((age - 0.65) / 0.25);
    return attack * tail * (
      0.78 * Math.sin(p) * Math.exp(-age * 5.5) +
      0.18 * Math.sin(p * 2.003) * Math.exp(-age * 9) +
      0.045 * Math.sin(p * 3.01) * Math.exp(-age * 13)
    );
  };
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate;
    let value = 0;
    for (let k = 0; k < notes.length; k++) {
      const age = t - starts[k];
      const pitch = notes[k];
      const level = (0.6 + 0.4 * smooth(k / 6)) * (1 - 0.22 * smooth((k - 9) / 4));
      value += level * (strike(age, pitch) + 0.19 * strike(age - 0.115, pitch)
        + 0.09 * strike(age - 0.237, pitch));
    }
    samples[i] = value * (1 - smooth((t - 1.27) / 0.38));
  }
  return normalize(samples, 0.48);
}

/** One buffer makes the magic and laugh sequential, never overlapping. */
export function createSantaGreeting(rate: number, voice: Float32Array): Float32Array {
  const magic = createSantaMagic(rate);
  const samples = new Float32Array(magic.length + voice.length);
  samples.set(magic);
  samples.set(voice, magic.length);
  return samples;
}

/** Smooth audibility: full nearby, silent at the outer radius. */
export function distanceGain(distance: number, near: number, far: number): number {
  return 1 - smooth((distance - near) / (far - near));
}

/** A sky flypast is deliberately audible much farther away than ground traffic. */
export function santaGreetingGain(distance: number): number {
  return distanceGain(distance, 145, 250) * 0.85;
}

/** Wait until the sleigh is crossing into the centre of the scene. */
export function shouldGreetSanta(distance: number, flightProgress: number | null): boolean {
  return flightProgress !== null && flightProgress >= 0.38 && distance < 210;
}
