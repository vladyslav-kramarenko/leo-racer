import { ACCEPTED_TYPES, preprocessImage, requestProcessing } from '../drawings/DrawingProcessor';
import type { DrawingManager } from '../drawings/DrawingManager';
import type { DrawingFrequency } from '../drawings/DrawingSprite';
import { effectiveCanMove, type CustomAsset } from '../drawings/DrawingStorage';
import { getInstallationId, loadSettings, saveSettings } from '../storage/settings';
import { clear, h } from './dom';
import type { Screen } from './ParentMenu';

/** Rare / Normal / Often — no numeric spawn rates for parents. */
function frequencyControl(initial: DrawingFrequency, onChange: (f: DrawingFrequency) => void): HTMLElement {
  const options: [DrawingFrequency, string][] = [
    ['rare', 'Rare'],
    ['normal', 'Normal'],
    ['often', 'Often'],
  ];
  const buttons = options.map(([value, label]) => {
    const b = h('button', { type: 'button', class: 'segment small', 'data-testid': `frequency-${value}` }, label);
    b.addEventListener('click', () => {
      buttons.forEach((x, i) => x.classList.toggle('active', options[i][0] === value));
      onChange(value);
    });
    b.classList.toggle('active', value === initial);
    return b;
  });
  return h('div', { class: 'segmented' }, ...buttons);
}

/** MOVES / STAYS segmented control. AI classification is only a suggestion. */
function movesToggle(initial: boolean, onChange: (moves: boolean) => void): HTMLElement {
  const moves = h('button', { type: 'button', class: 'segment', 'data-testid': 'moves-button' }, 'MOVES');
  const stays = h('button', { type: 'button', class: 'segment', 'data-testid': 'stays-button' }, 'STAYS');
  const set = (value: boolean) => {
    moves.classList.toggle('active', value);
    stays.classList.toggle('active', !value);
  };
  set(initial);
  moves.addEventListener('click', () => {
    set(true);
    onChange(true);
  });
  stays.addEventListener('click', () => {
    set(false);
    onChange(false);
  });
  return h('div', { class: 'segmented' }, moves, stays);
}

export function createAddDrawingScreen(drawings: DrawingManager): Screen {
  return (panel, back) => {
    let disposed = false;
    const previewUrls: string[] = [];
    const preview = (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      previewUrls.push(url);
      return h('img', { class: 'drawing-preview', src: url, alt: 'Drawing preview' });
    };

    const body = h('div', { class: 'dialog-body' });
    panel.append(
      h('h2', {}, 'Add Drawing'),
      h('p', { class: 'hint' }, 'Take a photo of a drawing (JPEG, PNG or WebP). It is resized on this device before upload.'),
      body,
      h('button', { type: 'button', class: 'menu-button', onclick: back }, 'Back'),
    );

    const showPicker = () => {
      clear(body);
      const input = h('input', {
        type: 'file',
        accept: ACCEPTED_TYPES.join(','),
        'data-testid': 'drawing-file-input',
      });
      const token = h('input', {
        type: 'password',
        class: 'text-input',
        placeholder: 'AI access code (from the alpha invite)',
        value: loadSettings().alphaToken,
        autocomplete: 'off',
      });
      token.addEventListener('change', () => saveSettings({ alphaToken: token.value.trim() }));
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (file) void run(file);
      });
      body.append(
        h('label', { class: 'file-label' }, h('span', { class: 'menu-button primary' }, 'Choose image…'), input),
        h('label', { class: 'field' }, h('span', {}, 'AI access code'), token),
      );
    };

    const showBusy = (text: string) => {
      clear(body);
      body.append(h('div', { class: 'busy' }, h('div', { class: 'spinner' }), h('p', {}, text)));
    };

    const run = async (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        clear(body);
        body.append(h('p', { class: 'error' }, 'Please choose a JPEG, PNG or WebP image.'));
        setTimeout(() => !disposed && showPicker(), 1800);
        return;
      }
      showBusy('Preparing image…');
      let resized: Blob;
      try {
        resized = await preprocessImage(file);
      } catch (err) {
        console.warn('[leo] preprocess failed', err);
        if (disposed) return;
        clear(body);
        body.append(h('p', { class: 'error' }, 'This image could not be read. Please try another one.'));
        body.append(h('button', { type: 'button', class: 'menu-button', onclick: showPicker }, 'Choose another'));
        return;
      }
      await process(resized);
    };

    const process = async (resized: Blob) => {
      if (disposed) return;
      showBusy('Cleaning up the drawing… (this can take a little while)');
      const result = await requestProcessing(resized, getInstallationId(), loadSettings().alphaToken);
      if (disposed) return;

      if (result.ok) {
        const asset = await drawings.add({
          image: result.image,
          canMove: result.canMove,
          confidence: result.confidence,
          source: 'ai',
        });
        showDone(asset);
        return;
      }

      clear(body);
      body.append(h('p', { class: 'error', 'data-testid': 'drawing-error' }, result.message));
      body.append(
        preview(resized),
        h(
          'div',
          { class: 'button-row' },
          result.reason !== 'quota' && result.reason !== 'globalLimit'
            ? h('button', { type: 'button', class: 'menu-button primary', onclick: () => process(resized) }, 'TRY AGAIN')
            : null,
          h(
            'button',
            {
              type: 'button',
              class: 'menu-button',
              'data-testid': 'use-original',
              onclick: async () => {
                const asset = await drawings.add({ image: resized, canMove: false, confidence: null, source: 'original' });
                showDone(asset);
              },
            },
            'USE ORIGINAL',
          ),
        ),
      );
    };

    const showDone = (asset: CustomAsset) => {
      clear(body);
      body.append(
        preview(asset.processedImage),
        h('p', {}, 'Added to the world! Does it move by itself?'),
        movesToggle(effectiveCanMove(asset), (moves) => void drawings.setMoves(asset.id, moves)),
        h(
          'div',
          { class: 'button-row' },
          h('button', { type: 'button', class: 'menu-button primary', onclick: back }, 'Done'),
          h('button', { type: 'button', class: 'menu-button', onclick: showPicker }, 'Add another'),
        ),
      );
    };

    showPicker();
    return () => {
      disposed = true;
      previewUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  };
}

export function createManageDrawingsScreen(drawings: DrawingManager): Screen {
  return (panel, back) => {
    const list = h('div', { class: 'drawing-list' });
    const urls: string[] = [];

    const render = () => {
      urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
      clear(list);
      const assets = drawings.list();
      if (!assets.length) {
        list.append(h('p', { class: 'hint' }, 'No drawings yet. Use “Add Drawing” to put one in the world.'));
        return;
      }
      for (const asset of assets) {
        const url = URL.createObjectURL(asset.processedImage);
        urls.push(url);
        const del = h('button', { type: 'button', class: 'menu-button danger small' }, 'Delete');
        del.addEventListener('click', () => {
          if (del.dataset.confirm) void drawings.remove(asset.id);
          else {
            del.dataset.confirm = '1';
            del.textContent = 'Really delete?';
          }
        });
        list.append(
          h(
            'div',
            { class: 'drawing-item' },
            h('img', { src: url, alt: 'Drawing' }),
            h(
              'div',
              { class: 'drawing-controls' },
              movesToggle(effectiveCanMove(asset), (moves) => void drawings.setMoves(asset.id, moves)),
              frequencyControl(asset.frequency ?? 'normal', (f) => void drawings.setFrequency(asset.id, f)),
              h('span', { class: 'hint' }, asset.source === 'ai' ? 'AI cleaned' : 'Original'),
              del,
            ),
          ),
        );
      }
    };

    panel.append(
      h('h2', {}, 'Manage Drawings'),
      ...(drawings.isStorageAvailable()
        ? []
        : [h('p', { class: 'error' }, 'Browser storage is unavailable; drawings will not survive a reload.')]),
      list,
      h('button', { type: 'button', class: 'menu-button', onclick: back }, 'Back'),
    );
    render();
    // Re-render only on add/remove, not on toggle, to keep the list stable while tapping.
    let count = drawings.list().length;
    const unsubscribe = drawings.subscribe((assets) => {
      if (assets.length !== count) {
        count = assets.length;
        render();
      }
    });
    return () => {
      unsubscribe();
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  };
}
