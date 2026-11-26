import { h } from './dom';

const PARKED_BUS = `
<svg viewBox="0 0 160 90" width="220" height="124" aria-hidden="true">
  <ellipse cx="80" cy="82" rx="66" ry="6" fill="rgba(0,0,0,0.18)"/>
  <rect x="14" y="20" width="132" height="52" rx="10" fill="#ffc21a" stroke="#26282c" stroke-width="4"/>
  <rect x="24" y="30" width="22" height="18" rx="3" fill="#a6dcff"/>
  <rect x="52" y="30" width="22" height="18" rx="3" fill="#a6dcff"/>
  <rect x="80" y="30" width="22" height="18" rx="3" fill="#a6dcff"/>
  <rect x="108" y="30" width="28" height="18" rx="3" fill="#a6dcff"/>
  <rect x="14" y="54" width="132" height="5" fill="#26282c"/>
  <circle cx="44" cy="74" r="11" fill="#26282c"/>
  <circle cx="118" cy="74" r="11" fill="#26282c"/>
  <text x="128" y="16" font-size="16" font-family="system-ui" font-weight="800" fill="#26282c">z</text>
  <text x="140" y="8" font-size="12" font-family="system-ui" font-weight="800" fill="#26282c">z</text>
</svg>`;

/**
 * Calm child-facing ending: no countdown, no flashing, no big PLAY AGAIN button.
 * Continuing requires a parent (hold Esc / Parent Menu).
 */
export class EndScreen {
  readonly el: HTMLElement;

  constructor() {
    const art = h('div', { class: 'end-art' });
    art.innerHTML = PARKED_BUS;
    this.el = h(
      'div',
      { class: 'end-screen hidden', 'data-testid': 'end-screen', 'aria-live': 'polite' },
      art,
      h('h1', { class: 'title end-title' }, 'ALL DONE!'),
      h('p', { class: 'end-hint' }, 'Grown-ups: hold Esc (or the top-left corner) for 2 seconds to continue.'),
    );
  }

  mount(parent: HTMLElement): void {
    parent.append(this.el);
  }

  show(): void {
    this.el.classList.remove('hidden');
    // Next frame, so the fade-in transition runs.
    requestAnimationFrame(() => this.el.classList.add('visible'));
  }

  hide(): void {
    this.el.classList.remove('visible');
    this.el.classList.add('hidden');
  }
}
