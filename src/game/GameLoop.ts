export type FrameCallback = (dtSec: number, nowMs: number) => void;

/** requestAnimationFrame loop with dt clamping and FPS measurement. */
export class GameLoop {
  private handle = 0;
  private last = 0;
  private running = false;
  private fpsFrames = 0;
  private fpsTime = 0;
  private fps = 0;
  private minFps = Infinity;

  constructor(private readonly onFrame: FrameCallback) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.handle = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.handle);
  }

  getFps(): number {
    return this.fps;
  }

  getMinFps(): number {
    return Number.isFinite(this.minFps) ? this.minFps : 0;
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    // Clamp so a background tab or a hitch never produces a huge simulation step.
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;

    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 1) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      if (this.fps > 0 && document.visibilityState === 'visible') this.minFps = Math.min(this.minFps, this.fps);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }

    try {
      this.onFrame(dt, now);
    } catch (err) {
      // A single bad frame must never stop the drive.
      console.error('[leo] frame error', err);
    }
    this.handle = requestAnimationFrame(this.tick);
  };
}
