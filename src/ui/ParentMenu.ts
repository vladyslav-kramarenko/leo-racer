import { CONFIG } from '../game/config';
import { PLAY_TIME_OPTIONS, playTimeLabel, type SessionPhase } from '../session/SessionState';
import { TRAFFIC_DENSITIES, type TrafficDensity } from '../traffic/TrafficManager';
import { clear, h } from './dom';

export type TiltStatus = 'on' | 'off' | 'unavailable';

export interface ParentMenuHost {
  pause(): void;
  resume(): void;
  isSoundOn(): boolean;
  setSound(on: boolean): void;
  isFullscreen(): boolean;
  toggleFullscreen(): void;
  isDiagnosticsVisible(): boolean;
  setDiagnosticsVisible(visible: boolean): void;
  exportDiagnostics(): void;
  copyDiagnostics(): Promise<boolean>;
  worlds(): { id: string; name: string }[];
  currentWorld(): string;
  /** Saves the choice and reloads the page (no hot-swapping of 3D resources). */
  selectWorld(id: string): void;
  drawingCount(): number;
  playTimeMinutes(): number | null;
  setPlayTimeMinutes(minutes: number | null): void;
  sessionPhase(): SessionPhase;
  startAnotherSession(): void;
  trafficDensity(): TrafficDensity;
  setTrafficDensity(density: TrafficDensity): void;
  tiltStatus(): TiltStatus;
  setTiltEnabled(enabled: boolean): Promise<TiltStatus>;
  recenterTilt(): void;
  isTiltInverted(): boolean;
  setTiltInverted(inverted: boolean): void;
}

/** A sub-screen renders into the panel and returns an optional cleanup function. */
export type Screen = (panel: HTMLElement, back: () => void) => (() => void) | void;

export interface ParentMenuScreens {
  addDrawing: Screen;
  manageDrawings: Screen;
  calibrateWheel: Screen;
}

export const PRIVACY_NOTE =
  'Leo Racer collects no child data: no names, ages, photos, video, microphone or location. ' +
  'Drawings are stored only in this browser. A drawing sent for AI processing is resized and stripped of ' +
  'photo metadata first, then temporarily transmitted through the Leo Racer server to the AI service; ' +
  'Leo Racer does not store it. Only an anonymous install id is counted for the monthly AI limit.';

/**
 * Parent-only overlay. Opened by holding ESC for ~2 s (or long-pressing the top-left corner).
 * Gameplay pauses while it is open.
 */
export class ParentMenu {
  readonly el: HTMLElement;
  private readonly panel: HTMLElement;
  private cleanup: (() => void) | void = undefined;
  private openState = false;
  private inSubScreen = false;

  constructor(
    private readonly host: ParentMenuHost,
    private readonly screens: ParentMenuScreens,
  ) {
    this.panel = h('div', { class: 'panel', role: 'dialog', 'aria-label': 'Parent menu' });
    this.el = h('div', { class: 'parent-overlay hidden', 'data-testid': 'parent-menu' }, this.panel);
  }

  mount(parent: HTMLElement): void {
    parent.append(this.el);
  }

  isOpen(): boolean {
    return this.openState;
  }

  open(): void {
    if (this.openState) return;
    this.openState = true;
    this.host.pause();
    this.el.classList.remove('hidden');
    this.showMain();
  }

  close(): void {
    if (!this.openState) return;
    this.runCleanup();
    this.openState = false;
    this.el.classList.add('hidden');
    this.host.resume();
  }

  /** ESC while open: back out of a sub-screen, or close the menu. */
  back(): void {
    if (this.inSubScreen) this.showMain();
    else this.close();
  }

  private runCleanup(): void {
    if (typeof this.cleanup === 'function') this.cleanup();
    this.cleanup = undefined;
  }

  private show(screen: Screen): void {
    this.runCleanup();
    clear(this.panel);
    this.inSubScreen = true;
    this.cleanup = screen(this.panel, () => this.showMain());
  }

  private showMain(): void {
    this.runCleanup();
    clear(this.panel);
    this.inSubScreen = false;
    const host = this.host;

    const button = (label: string, onClick: () => void, testId?: string, extraClass = '') =>
      h('button', { type: 'button', class: `menu-button ${extraClass}`, 'data-testid': testId, onclick: onClick }, label);

    const toggle = (get: () => boolean, set: (v: boolean) => void, labels: [string, string], testId?: string) => {
      const el = h('button', { type: 'button', class: 'toggle', 'aria-pressed': String(get()), 'data-testid': testId }, get() ? labels[0] : labels[1]);
      el.addEventListener('click', () => {
        const next = !get();
        set(next);
        el.textContent = next ? labels[0] : labels[1];
        el.setAttribute('aria-pressed', String(next));
      });
      return el;
    };

    const row = (label: string, control: HTMLElement) => h('div', { class: 'row' }, h('span', {}, label), control);

    // --- Session
    const phase = host.sessionPhase();
    const finished = phase === 'ending' || phase === 'finished';
    const playTime = h('select', { class: 'select', 'data-testid': 'play-time-select' });
    for (const minutes of PLAY_TIME_OPTIONS) {
      playTime.append(h('option', { value: minutes === null ? '' : String(minutes), selected: minutes === host.playTimeMinutes() }, playTimeLabel(minutes)));
    }
    playTime.addEventListener('change', () => host.setPlayTimeMinutes(playTime.value === '' ? null : Number(playTime.value)));

    const traffic = h('select', { class: 'select', 'data-testid': 'traffic-select' });
    for (const density of TRAFFIC_DENSITIES) {
      traffic.append(h('option', { value: density, selected: density === host.trafficDensity() }, density[0].toUpperCase() + density.slice(1)));
    }
    traffic.addEventListener('change', () => host.setTrafficDensity(traffic.value as TrafficDensity));

    // --- Tilt
    const tiltStatus = h('span', { class: 'hint' });
    const tiltButton = h('button', { type: 'button', class: 'toggle', 'data-testid': 'tilt-toggle' });
    const renderTilt = (status: TiltStatus) => {
      tiltButton.textContent = status === 'on' ? 'On' : 'Off';
      tiltButton.setAttribute('aria-pressed', String(status === 'on'));
      tiltStatus.textContent = status === 'unavailable' ? 'Tilt is not available on this device or was not allowed.' : '';
    };
    renderTilt(host.tiltStatus());
    tiltButton.addEventListener('click', async () => renderTilt(await host.setTiltEnabled(host.tiltStatus() !== 'on')));

    const worlds = host.worlds().map((w) => {
      const input = h('input', { type: 'radio', name: 'world', value: w.id, checked: w.id === host.currentWorld(), 'data-testid': `world-${w.id}` });
      input.addEventListener('change', () => host.selectWorld(w.id));
      return h('label', { class: 'radio' }, input, ' ', w.name);
    });

    const copyStatus = h('span', { class: 'hint' });

    this.panel.append(
      h('h2', {}, 'Parent Menu'),
      ...(finished
        ? [
            button('Start another session', () => {
              host.startAnotherSession();
              this.close();
            }, 'restart-session-button', 'primary'),
            button('Resume', () => this.close(), 'resume-button'),
          ]
        : [button('Resume', () => this.close(), 'resume-button', 'primary')]),
      h(
        'section',
        {},
        h('h3', {}, 'Drawings'),
        button('Add Drawing', () => this.show(this.screens.addDrawing), 'add-drawing-button'),
        button(`Manage Drawings (${host.drawingCount()})`, () => this.show(this.screens.manageDrawings), 'manage-drawings-button'),
      ),
      h(
        'section',
        {},
        h('h3', {}, 'Steering'),
        button('Calibrate Wheel', () => this.show(this.screens.calibrateWheel), 'calibrate-button'),
        row('Tilt steering (tablet)', tiltButton),
        tiltStatus,
        h(
          'div',
          { class: 'button-row' },
          button('Recenter Tilt Steering', () => host.recenterTilt(), 'recenter-tilt'),
        ),
        row('Invert tilt', toggle(() => host.isTiltInverted(), (v) => host.setTiltInverted(v), ['Yes', 'No'])),
      ),
      h(
        'section',
        { class: 'row-section' },
        h('h3', {}, 'Play'),
        row('Play time', playTime),
        row('Traffic', traffic),
        row('Sound', toggle(() => host.isSoundOn(), (v) => host.setSound(v), ['On', 'Off'], 'sound-toggle')),
        row(
          'Fullscreen',
          h('button', { type: 'button', class: 'toggle', onclick: () => host.toggleFullscreen() }, host.isFullscreen() ? 'Exit' : 'Enter'),
        ),
      ),
      h('section', {}, h('h3', {}, 'World'), ...worlds, h('p', { class: 'hint' }, 'Switching worlds restarts the game.')),
      h(
        'section',
        {},
        h('h3', {}, 'Diagnostics'),
        row('Overlay', toggle(() => host.isDiagnosticsVisible(), (v) => host.setDiagnosticsVisible(v), ['Shown', 'Hidden'])),
        h(
          'div',
          { class: 'button-row' },
          button('Export diagnostics', () => host.exportDiagnostics(), 'export-diagnostics'),
          button('Copy', async () => {
            copyStatus.textContent = (await host.copyDiagnostics()) ? 'Copied.' : 'Copy failed.';
          }),
        ),
        copyStatus,
      ),
      h('section', {}, h('h3', {}, 'Privacy'), h('p', { class: 'privacy' }, PRIVACY_NOTE)),
      h('p', { class: 'hint' }, `Leo Racer ${__APP_VERSION__} · Hold ESC for 2 seconds to open this menu.`),
    );
    this.panel.querySelector<HTMLButtonElement>('.menu-button.primary')?.focus();
  }
}

/**
 * Hidden parent gesture: hold ESC (or press-and-hold the top-left corner) for ~2 s.
 * A small ring shows progress while holding so a parent knows it is working.
 */
export class ParentGesture {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly ring: HTMLElement;

  constructor(
    private readonly menu: ParentMenu,
    private readonly holdMs: number = CONFIG.parentMenu.holdMs,
  ) {
    this.ring = h('div', { class: 'hold-ring hidden', 'aria-hidden': 'true' });
    this.ring.style.setProperty('--hold-ms', `${holdMs}ms`);
  }

  attach(root: HTMLElement): void {
    root.append(this.ring);

    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.menu.isOpen()) {
        if (!e.repeat) this.menu.back();
        return;
      }
      if (!e.repeat) this.begin();
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'Escape') this.cancel();
    });
    window.addEventListener('blur', () => this.cancel());

    const size = CONFIG.parentMenu.cornerSize;
    root.addEventListener('pointerdown', (e) => {
      if (this.menu.isOpen()) return;
      if (e.clientX <= size && e.clientY <= size) this.begin();
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
      root.addEventListener(type, () => this.cancel());
    }
  }

  private begin(): void {
    this.cancel();
    this.ring.classList.remove('hidden');
    // Restart the CSS progress animation.
    void this.ring.offsetWidth;
    this.ring.classList.add('holding');
    this.timer = setTimeout(() => {
      this.timer = null;
      this.hideRing();
      this.menu.open();
    }, this.holdMs);
  }

  private cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.hideRing();
  }

  private hideRing(): void {
    this.ring.classList.remove('holding');
    this.ring.classList.add('hidden');
  }
}
