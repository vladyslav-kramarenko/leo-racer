import { h } from './dom';

/** Big friendly brake symbol shown only while the touch brake zone is pressed. */
export class TouchBrakeIndicator {
  readonly el = h('div', { class: 'touch-brake hidden', 'aria-hidden': 'true', 'data-testid': 'touch-brake' });

  mount(parent: HTMLElement): void {
    this.el.innerHTML = `
      <svg viewBox="0 0 100 100" width="120" height="120">
        <polygon points="30,4 70,4 96,30 96,70 70,96 30,96 4,70 4,30" fill="#e8453c" stroke="#fff" stroke-width="5"/>
        <rect x="24" y="43" width="52" height="14" rx="5" fill="#fff"/>
      </svg>`;
    parent.append(this.el);
  }

  setVisible(visible: boolean): void {
    this.el.classList.toggle('hidden', !visible);
  }
}
