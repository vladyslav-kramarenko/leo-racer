import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WheelCalibration } from '../../src/input/SteeringState';
import { loadSettings, saveSettings } from '../../src/storage/settings';

const calibration: WheelCalibration = {
  gamepadId: 'Test Wheel', steeringAxis: 0, invertAxis: false,
  min: -1, center: 0, max: 1, deadzone: 0.04,
  brake: { axis: 1, released: 1, pressed: -1 },
  throttle: { axis: 2, released: 1, pressed: -1 },
  gearButtons: { up: 0, down: 1 },
  secondaryGearButtons: { up: 2, down: 3 },
};

function steeringOnly(): WheelCalibration {
  const steering = { ...calibration };
  delete steering.brake;
  delete steering.throttle;
  delete steering.gearButtons;
  delete steering.secondaryGearButtons;
  return steering;
}

describe('saved pedal defaults', () => {
  let values: Map<string, string>;
  beforeEach(() => {
    values = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('restores both pedals after loading and changing unrelated settings', () => {
    saveSettings({ calibration });
    saveSettings({ soundOn: false });
    expect(loadSettings().calibration).toEqual(calibration);
  });

  it('preserves pedals when steering is recalibrated', () => {
    saveSettings({ calibration });
    const steering = steeringOnly();
    const saved = saveSettings({ calibration: { ...steering, invertAxis: true } });
    expect(saved.calibration?.brake).toEqual(calibration.brake);
    expect(saved.calibration?.throttle).toEqual(calibration.throttle);
    expect(saved.calibration?.gearButtons).toEqual(calibration.gearButtons);
    expect(saved.calibration?.secondaryGearButtons).toEqual(calibration.secondaryGearButtons);
    expect(loadSettings().calibration?.invertAxis).toBe(true);
  });

  it('restores the default when general settings are missing or corrupt', () => {
    saveSettings({ calibration });
    values.delete('leo.settings');
    expect(loadSettings().calibration).toEqual(calibration);
    values.set('leo.settings', '{broken');
    expect(loadSettings().calibration).toEqual(calibration);
  });

  it('repairs steering-only settings using the saved pedal defaults', () => {
    saveSettings({ calibration });
    const steering = steeringOnly();
    values.set('leo.settings', JSON.stringify({ calibration: steering }));
    expect(loadSettings().calibration).toEqual(calibration);
  });

  it('honours an explicit reset and does not resurrect pedal defaults', () => {
    saveSettings({ calibration });
    saveSettings({ calibration: null });
    expect(loadSettings().calibration).toBeNull();
    values.delete('leo.settings');
    expect(loadSettings().calibration).toBeNull();
  });

  it('keeps the second set removed after reload and steering recalibration', () => {
    saveSettings({ calibration });
    saveSettings({ calibration: { ...calibration, secondaryGearButtons: null } });
    expect(loadSettings().calibration?.secondaryGearButtons).toBeNull();
    saveSettings({ calibration: steeringOnly() });
    expect(loadSettings().calibration?.secondaryGearButtons).toBeNull();
    expect(loadSettings().calibration?.gearButtons).toEqual(calibration.gearButtons);
  });

  it('does not apply another wheel’s pedal defaults', () => {
    saveSettings({ calibration });
    const steering = steeringOnly();
    saveSettings({ calibration: { ...steering, gamepadId: 'Other Wheel' } });
    expect(loadSettings().calibration?.brake).toBeUndefined();
    expect(loadSettings().calibration?.throttle).toBeUndefined();
  });
});
