import { CONFIG } from '../game/config';
import { CalibrationRecorder, type GamepadInput } from '../input/GamepadInput';
import { normalizeAxis, normalizePedal, type PedalCalibration, type WheelCalibration } from '../input/SteeringState';
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
        const pads = gamepad.snapshots();
        const pad = pads.find((p) => p.id === current?.gamepadId) ?? pads[0];
        if (pad && current?.gamepadId === pad.id) showDone(current);
        else if (pad) startRange(pad.id);
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
        h('p', { class: 'hint' }, 'Leave the pedals released during steering calibration.'),
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
            const saved = gamepad.getCalibration();
            const final: WheelCalibration = {
              ...(saved?.gamepadId === cal.gamepadId ? saved : {}),
              ...cal,
              invertAxis: value < 0,
            };
            onSave(final);
            startPedal(final);
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

    const startPedal = (cal: WheelCalibration, kind: 'brake' | 'throttle' = 'brake') => {
      stop();
      clear(body);
      const status = h('p', { class: 'hint' });
      body.append(
        h('p', { class: 'prompt' }, 'Release both pedals.'),
        h('p', { class: 'hint' }, kind === 'brake'
          ? 'The brake pedal stops the bus. It drives automatically when released.'
          : 'The accelerator increases cruising speed from 1.5× to 3× as you press it. Release it to return to normal speed.'),
        status,
      );
      setFooter(
        h('button', { type: 'button', class: 'menu-button primary', onclick: () => {
          const pad = gamepad.snapshots().find((p) => p.id === cal.gamepadId);
          if (!pad) {
            status.textContent = 'Wheel disconnected. Reconnect it to continue.';
            return;
          }
          recordPedal(cal, pad.axes.slice(), kind);
        } }, 'Pedals released — Next'),
        h('button', { type: 'button', class: 'menu-button', onclick: () => showDone(cal) }, 'Skip pedals'),
      );
    };

    const recordPedal = (cal: WheelCalibration, released: readonly number[], kind: 'brake' | 'throttle') => {
      stop();
      clear(body);
      const status = h('p', { class: 'hint' });
      const readings = h('p', { class: 'hint' });
      let detected: PedalCalibration | null = null;
      const save = h('button', { type: 'button', class: 'menu-button primary', disabled: true, onclick: () => {
        if (!detected) return;
        const final = { ...cal, [kind]: detected };
        onSave(final);
        showDone(final);
      } }, kind === 'brake' ? 'Save brake pedal' : 'Save accelerator pedal');
      body.append(
        h('p', { class: 'prompt' }, kind === 'brake' ? 'Press the BRAKE pedal fully and hold it.' : 'Press the ACCELERATOR pedal fully and hold it.'),
        h('p', { class: 'hint' }, kind === 'brake'
          ? 'Keep the accelerator released. Then click Save brake pedal while holding the brake.'
          : 'Keep the brake released. Then click Save accelerator pedal while holding the accelerator.'),
        readings,
        status,
      );
      setFooter(save, h('button', { type: 'button', class: 'menu-button', onclick: () => showDone(cal) }, 'Skip pedals'));
      const tick = () => {
        const pad = gamepad.snapshots().find((p) => p.id === cal.gamepadId);
        detected = null;
        let movement: number = CONFIG.gamepad.minCalibrationRange;
        if (pad) {
          readings.textContent = pad.axes.map((value, axis) => `Axis ${axis}: ${value.toFixed(3)}`).join(' · ');
          pad.axes.forEach((value, axis) => {
            const rest = released[axis];
            if (axis === cal.steeringAxis || rest === undefined || !Number.isFinite(value) || !Number.isFinite(rest)) return;
            const delta = Math.abs(value - rest);
            if (delta >= movement) {
              movement = delta;
              detected = { axis, released: rest, pressed: value };
            }
          });
        }
        save.disabled = !detected;
        status.textContent = !pad ? 'Wheel disconnected. Reconnect it to continue.'
          : detected ? `${kind === 'brake' ? 'Brake' : 'Accelerator'} detected: axis ${(detected as PedalCalibration).axis}. Hold it fully pressed and save.`
          : 'Waiting for pedal movement. If no axis changes, check the wheel driver and pedal mode.';
        raf = requestAnimationFrame(tick);
      };
      tick();
    };

    const startGearButtons = (cal: WheelCalibration) => {
      const capture = (direction: 'up' | 'down', up?: number) => {
        stop();
        clear(body);
        const status = h('p', { class: 'hint' });
        body.append(
          h('p', { class: 'prompt' }, direction === 'up' ? 'Press the wheel button for GEAR UP.' : 'Release it, then press the wheel button for GEAR DOWN.'),
          h('p', { class: 'hint' }, 'Use two different buttons or the two directions of your sequential shifter.'),
          status,
        );
        setFooter(h('button', { type: 'button', class: 'menu-button', onclick: () => showDone(cal) }, 'Cancel'));
        let previous: readonly boolean[] | null = null;
        const tick = () => {
          const pad = gamepad.snapshots().find((p) => p.id === cal.gamepadId);
          if (!pad) {
            previous = null;
            status.textContent = 'Wheel disconnected. Reconnect it to continue.';
          } else {
            const pressed = previous ? pad.buttons.findIndex((value, index) => value && !previous![index]) : -1;
            previous = pad.buttons.slice();
            if (pressed >= 0) {
              if (direction === 'up') {
                capture('down', pressed);
                return;
              }
              if (pressed === up) status.textContent = 'Choose a different button for gear down.';
              else {
                const final: WheelCalibration = { ...cal, gearButtons: { up: up!, down: pressed } };
                onSave(final);
                showDone(final);
                return;
              }
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      };
      capture('up');
    };

    const showDone = (cal: WheelCalibration) => {
      stop();
      clear(body);
      const meter = h('div', { class: 'steer-meter' }, h('div', { class: 'needle' }));
      const pedalStatus = h('p', { class: 'hint' });
      const throttleStatus = h('p', { class: 'hint' });
      const hapticStatus = h('p', { class: 'hint' });
      body.append(
        h('p', { class: 'prompt' }, 'Wheel calibrated!'),
        h('p', { class: 'hint' }, `Axis ${cal.steeringAxis}${cal.invertAxis ? ' (inverted)' : ''}. Try it: the marker should follow the wheel.`),
        meter,
        pedalStatus,
        throttleStatus,
        hapticStatus,
        h('p', { class: 'hint' }, `Gear up: button ${cal.gearButtons?.up ?? 5}; gear down: button ${cal.gearButtons?.down ?? 4}. These buttons change gear instead of honking.`),
      );
      setFooter(
        h('button', { type: 'button', class: 'menu-button primary', onclick: back }, 'Done'),
        h('button', { type: 'button', class: 'menu-button', onclick: () => startRange(cal.gamepadId) }, 'Calibrate again'),
        h('button', { type: 'button', class: 'menu-button', onclick: () => startPedal(cal) }, 'Calibrate brake pedal'),
        h('button', { type: 'button', class: 'menu-button', onclick: () => startPedal(cal, 'throttle') }, 'Calibrate accelerator pedal'),
        h('button', { type: 'button', class: 'menu-button', onclick: () => startGearButtons(cal) }, 'Assign gear buttons'),
        h('button', { type: 'button', class: 'menu-button', onclick: () => {
          gamepad.update();
          gamepad.haptics.impact(performance.now());
        } }, 'Test vibration'),
        h('button', { type: 'button', class: 'menu-button', onclick: () => { onSave(null); waitForPad(); } }, 'Reset calibration'),
      );
      const needle = meter.querySelector<HTMLElement>('.needle')!;
      const tick = () => {
        const pad = gamepad.snapshots().find((p) => p.id === cal.gamepadId);
        const value = pad ? normalizeAxis(pad.axes[cal.steeringAxis] ?? 0, cal) : 0;
        needle.style.left = `${((value + 1) / 2) * 100}%`;
        const rawBrake = cal.brake && pad ? pad.axes[cal.brake.axis] : undefined;
        pedalStatus.textContent = cal.brake
          ? `Brake axis ${cal.brake.axis}: ${Math.round((rawBrake === undefined ? 0 : normalizePedal(rawBrake, cal.brake)) * 100)}%`
          : 'Brake pedal not calibrated. Keyboard and touch braking are available.';
        const rawThrottle = cal.throttle && pad ? pad.axes[cal.throttle.axis] : undefined;
        throttleStatus.textContent = cal.throttle
          ? `Accelerator axis ${cal.throttle.axis}: ${Math.round((rawThrottle === undefined ? 0 : normalizePedal(rawThrottle, cal.throttle)) * 100)}%`
          : 'Accelerator pedal not calibrated. Hold ↑ or W for 3× speed.';
        hapticStatus.textContent = pad?.hapticActuator
          ? `Browser vibration: ${gamepad.haptics.getStatus()}. Use Test vibration to try a short impulse.`
          : 'Browser vibration is not exposed for this device. Wheel steering torque needs a native Windows bridge.';
        raf = requestAnimationFrame(tick);
      };
      tick();
    };

    waitForPad();
    return stop;
  };
}
