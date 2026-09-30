import { h } from './dom';

/** The only screen before driving: title and one big button. No login, no menus. */
export class StartScreen {
  readonly el: HTMLElement;

  constructor(onStart: (fullscreen: boolean) => void) {
    const start = h(
      'button',
      { class: 'start-button', type: 'button', 'data-testid': 'start-button' },
      'START DRIVING',
    );
    const fullscreen = h('button', { class: 'link-button', type: 'button' }, 'Start in full screen');
    start.addEventListener('click', () => onStart(false));
    fullscreen.addEventListener('click', () => onStart(true));

    this.el = h(
      'div',
      { class: 'start-screen', 'data-testid': 'start-screen' },
      h('h1', { class: 'title' }, 'LEO RACER'),
      start,
      fullscreen,
    );
  }

  mount(parent: HTMLElement): void {
    parent.append(this.el);
    this.el.querySelector<HTMLButtonElement>('.start-button')?.focus();
  }

  hide(): void {
    this.el.classList.add('hidden');
    setTimeout(() => this.el.remove(), 400);
  }
}
