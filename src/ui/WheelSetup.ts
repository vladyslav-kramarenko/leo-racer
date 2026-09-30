import { CONFIG } from '../game/config';
import { CalibrationRecorder, type GamepadInput } from '../input/GamepadInput';
import { normalizeAxis, type WheelCalibration } from '../input/SteeringState';
import { clear, h } from './dom';
import type { Screen } from './ParentMenu';

/**
 * Wheel calibration:
 *  1. "Turn the wheel left and right." — records every axis; the widest range is steering.
 *  2. "Now turn the wheel to the RIGHT and hold." — confirms direction (sets invertAxis).
 */
export function createWheelSetupScreen(
  gamepad: GamepadInput,
  onSave: (cal: WheelCalibration | null) => void,
): Screen {
  return (panel, back) => {
    let raf = 0;
    const body = h('div', { class: 'dialog-body' });
    panel.append(h('h2', {}, 'Calibrate Wheel'), body);

    const footer = h('div', { class: 'button-row' });
    panel.append(footer);

    const setFooter = (...buttons: HTMLElement[]) => {
      clear(footer);
      footer.append(...buttons, h('button', { type: 'button', class: 'menu-button', onclick: back }, 'Back'));
    };

    const stop = () => cancelAnimationFrame(raf);

    const waitForPad = () => {
      stop();
      clear(body);
      const current = gamepad.getCalibration();
      body.append(
        h('p', {}, 'Connect the steering wheel, then press any button or turn it.'),
        h('p', { class: 'hint' }, 'Browsers only report a wheel after it has been touched once.'),
        current
          ? h('p', { class: 'hint' }, `Saved: axis ${current.steeringAxis}${current.invertAxis ? ' (inverted)' : ''} — ${current.gamepadId}`)
          : h('p', { class: 'hint' }, 'Not calibrated yet: axis 0 is used by default.'),
      );
      setFooter(
        ...(current
          ? [h('button', { type: 'button', class: 'menu-button', onclick: () => { onSave(null); waitForPad(); } }, 'Reset calibration')]
          : []),
      );
      const poll = () => {
        const pad = gamepad.snapshots()[0];
        if (pad) startRange(pad.id);
        else raf = requestAnimationFrame(poll);
      };
      poll();
    };

    const startRange = (gamepadId: string) => {
      stop();
      clear(body);
      const recorder = new CalibrationRecorder(gamepadId);
      const bars = h('div', { class: 'axis-bars' });
      const status = h('p', { class: 'hint' });
      const next = h('button', { type: 'button', class: 'menu-button primary', disabled: true }, 'Next');
      body.append(
        h('p', { class: 'prompt' }, 'Turn the wheel left and right.'),
        h('p', { class: 'hint' }, `Device: ${gamepadId}`),
        bars,
        status,
      );
      setFooter(next);

      next.addEventListener('click', () => {
        const cal = recorder.build(CONFIG.gamepad.deadzone);
        if (cal) startDirection(cal);
      });

      const tick = () => {
        const pad = gamepad.snapshots().find((p) => p.id === gamepadId);
        if (!pad) {
          status.textContent = 'Wheel disconnected. Reconnect it to continue.';
          raf = requestAnimationFrame(tick);
          return;
        }
        recorder.sample(pad.axes);
        const best = recorder.best();
        clear(bars);
        for (const r of recorder.allRanges()) {
          const value = pad.axes[r.axis] ?? 0;
          const isBest = best?.axis === r.axis;
          bars.append(
            h(
              'div',
              { class: `axis-bar${isBest ? ' best' : ''}` },
              h('span', {}, `Axis ${r.axis}`),
              h(
                'div',
                { class: 'track' },
                h('div', {
                  class: 'range',
                  style: `left:${((r.min + 1) / 2) * 100}%;width:${((r.max - r.min) / 2) * 100}%`,
                }),
                h('div', { class: 'marker', style: `left:${((value + 1) / 2) * 100}%` }),
              ),
            ),
          );
        }
        const ok = !!best && best.max - best.min >= CONFIG.gamepad.minCalibrationRange;
        next.disabled = !ok;
        status.textContent = ok
          ? `Steering axis detected: axis ${best!.axis}. Turn fully both ways, then press Next.`
          : 'Keep turning the wheel all the way left and right…';
        raf = requestAnimationFrame(tick);
      };
      tick();
    };

    const startDirection = (cal: WheelCalibration) => {
      stop();
      clear(body);
      const status = h('p', { class: 'hint' }, 'Waiting…');
      body.append(h('p', { class: 'prompt' }, 'Now turn the wheel to the RIGHT and hold it.'), status);
      setFooter();
      let heldSince = 0;
      const tick = (now: number) => {
        const pad = gamepad.snapshots().find((p) => p.id === cal.gamepadId);
        const value = pad ? normalizeAxis(pad.axes[cal.steeringAxis] ?? 0, cal) : 0;
        if (Math.abs(value) > 0.5) {
          heldSince ||= now;
          status.textContent = 'Hold…';
          if (now - heldSince > 500) {
            const final: WheelCalibration = { ...cal, invertAxis: value < 0 };
            onSave(final);
            showDone(final);
            return;
          }
        } else {
          heldSince = 0;
          status.textContent = 'Turn it further to the right…';
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const showDone = (cal: WheelCalibration) => {
      stop();
      clear(body);
      const meter = h('div', { class: 'steer-meter' }, h('div', { class: 'needle' }));
      body.append(
        h('p', { class: 'prompt' }, 'Wheel calibrated!'),
        h('p', { class: 'hint' }, `Axis ${cal.steeringAxis}${cal.invertAxis ? ' (inverted)' : ''}. Try it: the marker should follow the wheel.`),
        meter,
      );
      setFooter(
        h('button', { type: 'button', class: 'menu-button primary', onclick: back }, 'Done'),
        h('button', { type: 'button', class: 'menu-button', onclick: () => startRange(cal.gamepadId) }, 'Calibrate again'),
      );
      const needle = meter.querySelector<HTMLElement>('.needle')!;
      const tick = () => {
        const pad = gamepad.snapshots().find((p) => p.id === cal.gamepadId);
        const value = pad ? normalizeAxis(pad.axes[cal.steeringAxis] ?? 0, cal) : 0;
        needle.style.left = `${((value + 1) / 2) * 100}%`;
        raf = requestAnimationFrame(tick);
      };
      tick();
    };

    waitForPad();
    return stop;
  };
}
