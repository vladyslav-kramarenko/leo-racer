import { h } from './dom';

/** A short cartoon pop whenever the driver changes gear. */
export class GearIndicator {
  private readonly number = h('span', { class: 'gear-indicator-number' });
  readonly el = h('div', { class: 'gear-indicator hidden', role: 'status', 'data-testid': 'gear-indicator' },
    h('span', { class: 'gear-indicator-label', 'aria-hidden': 'true' }, 'GEAR'), this.number);
  private timer: ReturnType<typeof setTimeout> | undefined;

  mount(parent: HTMLElement): void {
    parent.append(this.el);
  }

  show(gear: number): void {
    this.hide();
    this.number.textContent = String(gear);
    this.el.setAttribute('aria-label', `Gear ${gear}`);
    // Restart the pop even when several shifts arrive close together.
    void this.el.offsetWidth;
    this.el.classList.remove('hidden');
    this.timer = setTimeout(() => this.hide(), 1500);
  }

  hide(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.el.classList.add('hidden');
  }
}
