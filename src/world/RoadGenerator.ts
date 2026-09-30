import type { RoadCurve } from './presets/types';

export interface RoadFrame {
  /** Centre-line position in world space. */
  x: number;
  z: number;
  /** Unit forward vector (world x/z). */
  fx: number;
  fz: number;
  /** Unit right vector (world x/z). */
  rx: number;
  rz: number;
  /** Heading angle; 0 = straight ahead (-Z), positive = turned right. */
  heading: number;
}

/**
 * Infinite, deterministic road centre-line: a sum of gentle sinusoids.
 * The road parameter `s` runs forward along world -Z; the centre-line bends along X.
 * Being stateless, any chunk can be (re)generated independently.
 */
export class RoadGenerator {
  constructor(private readonly curve: readonly RoadCurve[]) {}

  centerX(s: number): number {
    let x = 0;
    for (const c of this.curve) x += c.amplitude * Math.sin((2 * Math.PI * s) / c.wavelength + c.phase);
    return x;
  }

  /** dX/ds */
  slope(s: number): number {
    let d = 0;
    for (const c of this.curve) {
      const k = (2 * Math.PI) / c.wavelength;
      d += c.amplitude * k * Math.cos(k * s + c.phase);
    }
    return d;
  }

  /** d²X/ds² */
  private slope2(s: number): number {
    let d = 0;
    for (const c of this.curve) {
      const k = (2 * Math.PI) / c.wavelength;
      d -= c.amplitude * k * k * Math.sin(k * s + c.phase);
    }
    return d;
  }

  /** Signed curvature (1/m); positive = bending right. */
  curvature(s: number): number {
    const d1 = this.slope(s);
    return this.slope2(s) / Math.pow(1 + d1 * d1, 1.5);
  }

  frame(s: number, out: RoadFrame = emptyFrame()): RoadFrame {
    const heading = Math.atan(this.slope(s));
    const sin = Math.sin(heading);
    const cos = Math.cos(heading);
    out.x = this.centerX(s);
    out.z = -s;
    out.fx = sin;
    out.fz = -cos;
    out.rx = cos;
    out.rz = sin;
    out.heading = heading;
    return out;
  }

  /** World x/z of a point at road distance `s` and lateral offset `d`. */
  point(s: number, d: number, out: { x: number; z: number } = { x: 0, z: 0 }): { x: number; z: number } {
    const f = this.frame(s, scratch);
    out.x = f.x + f.rx * d;
    out.z = f.z + f.rz * d;
    return out;
  }
}

function emptyFrame(): RoadFrame {
  return { x: 0, z: 0, fx: 0, fz: -1, rx: 1, rz: 0, heading: 0 };
}

const scratch = emptyFrame();
