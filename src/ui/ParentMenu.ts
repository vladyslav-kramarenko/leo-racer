import { CONFIG } from '../game/config';
import { clear, h } from './dom';

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
  drawingCount(): number;
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

    const soundToggle = h(
      'button',
      { type: 'button', class: 'toggle', 'aria-pressed': String(host.isSoundOn()), 'data-testid': 'sound-toggle' },
      host.isSoundOn() ? 'On' : 'Off',
    );
    soundToggle.addEventListener('click', () => {
      const next = !host.isSoundOn();
      host.setSound(next);
      soundToggle.textContent = next ? 'On' : 'Off';
      soundToggle.setAttribute('aria-pressed', String(next));
    });

    const diagToggle = h(
      'button',
      { type: 'button', class: 'toggle', 'aria-pressed': String(host.isDiagnosticsVisible()) },
      host.isDiagnosticsVisible() ? 'Shown' : 'Hidden',
    );
    diagToggle.addEventListener('click', () => {
      const next = !host.isDiagnosticsVisible();
      host.setDiagnosticsVisible(next);
      diagToggle.textContent = next ? 'Shown' : 'Hidden';
      diagToggle.setAttribute('aria-pressed', String(next));
    });

    const copyStatus = h('span', { class: 'hint' });
    const worlds = host.worlds().map((w) =>
      h(
        'label',
        { class: 'radio' },
        h('input', { type: 'radio', name: 'world', value: w.id, checked: w.id === host.currentWorld() }),
        ' ',
        w.name,
      ),
    );

    this.panel.append(
      h('h2', {}, 'Parent Menu'),
      button('Resume', () => this.close(), 'resume-button', 'primary'),
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
        h('h3', {}, 'Steering wheel'),
        button('Calibrate Wheel', () => this.show(this.screens.calibrateWheel), 'calibrate-button'),
      ),
      h('section', {}, h('h3', {}, 'World'), ...worlds),
      h(
        'section',
        { class: 'row-section' },
        h('div', { class: 'row' }, h('span', {}, 'Sound'), soundToggle),
        h(
          'div',
          { class: 'row' },
          h('span', {}, 'Fullscreen'),
          h(
            'button',
            { type: 'button', class: 'toggle', onclick: () => host.toggleFullscreen() },
            host.isFullscreen() ? 'Exit' : 'Enter',
          ),
        ),
      ),
      h(
        'section',
        {},
        h('h3', {}, 'Diagnostics'),
        h('div', { class: 'row' }, h('span', {}, 'Overlay'), diagToggle),
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
    this.panel.querySelector<HTMLButtonElement>('[data-testid="resume-button"]')?.focus();
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
