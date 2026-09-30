import type { LiveDiagnostics } from '../diagnostics/Diagnostics';
import { h } from './dom';

/** Debug overlay — only reachable from the Parent Menu (or ?debug in development). */
export class DiagnosticsOverlay {
  readonly el = h('pre', { class: 'diagnostics hidden', 'data-testid': 'diagnostics' });
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly source: () => LiveDiagnostics) {}

  mount(parent: HTMLElement): void {
    parent.append(this.el);
  }

  isVisible(): boolean {
    return this.timer !== null;
  }

  setVisible(visible: boolean): void {
    if (visible === this.isVisible()) return;
    this.el.classList.toggle('hidden', !visible);
    if (visible) {
      this.render();
      this.timer = setInterval(() => this.render(), 250);
    } else if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private render(): void {
    const d = this.source();
    this.el.textContent = [
      `FPS            ${d.fps}`,
      `resolution     ${d.resolution}`,
      `pixelRatio     ${d.devicePixelRatio}`,
      `draw calls     ${d.drawCalls}`,
      ``,
      `input source   ${d.inputSource}`,
      `gamepad        ${d.gamepadId}`,
      `steering axis  ${d.steeringAxis}`,
      `raw steering   ${d.rawSteering.toFixed(3)}`,
      `normalized     ${d.normalizedSteering.toFixed(3)}`,
      `speed          ${d.speedKmh.toFixed(1)} km/h${d.braking ? ' (braking)' : ''}`,
      ``,
      `mode           ${d.mode} (manual ${Math.round(d.manualWeight * 100)}%)`,
      ``,
      `world chunks   ${d.worldChunks}`,
      `active sprites ${d.activeSprites}`,
      ``,
      `version        ${d.appVersion}`,
    ].join('\n');
  }
}
