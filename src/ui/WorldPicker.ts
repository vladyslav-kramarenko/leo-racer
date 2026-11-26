import { h } from './dom';

export interface WorldOption {
  id: string;
  name: string;
  thumbnail?: string;
}

/** Shared location cards for the entrance screen and Parent Menu. */
export function createWorldPicker(worlds: readonly WorldOption[], currentId: string, onSelect: (id: string) => void): HTMLElement {
  return h('div', { class: 'world-grid', role: 'group', 'aria-label': 'Choose a location' }, ...worlds.map((world) => {
    const current = world.id === currentId;
    return h('button', {
      type: 'button',
      class: `world-card${current ? ' current' : ''}`,
      'aria-pressed': String(current),
      'data-testid': `world-${world.id}`,
      onclick: () => { if (!current) onSelect(world.id); },
    },
    world.thumbnail ? h('img', { src: world.thumbnail, alt: '', loading: 'lazy' }) : h('div', { class: 'world-card-blank' }),
    h('span', {}, world.name));
  }));
}
