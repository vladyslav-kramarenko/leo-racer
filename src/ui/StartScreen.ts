import { h } from './dom';
import { createWorldPicker, type WorldOption } from './WorldPicker';

/** Location cards above the title and big start button. */
export class StartScreen {
  readonly el: HTMLElement;

  constructor(onStart: (fullscreen: boolean) => void, picker: {
    worlds: readonly WorldOption[];
    currentId: string;
    onSelect: (id: string) => void;
  }) {
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
      h('section', { class: 'start-worlds' }, createWorldPicker(picker.worlds, picker.currentId, picker.onSelect)),
      h('div', { class: 'start-content' }, h('h1', { class: 'title' }, 'LEO RACER'), start, fullscreen),
    );
  }

  mount(parent: HTMLElement): void {
    parent.append(this.el);
    this.el.querySelector<HTMLButtonElement>('.start-button')?.focus({ preventScroll: true });
  }

  hide(): void {
    this.el.classList.add('hidden');
    setTimeout(() => this.el.remove(), 400);
  }
}
