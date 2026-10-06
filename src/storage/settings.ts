import type { WheelCalibration } from '../input/SteeringState';
import type { TrafficDensity } from '../traffic/TrafficManager';

export interface Settings {
  soundOn: boolean;
  worldId: string;
  calibration: WheelCalibration | null;
  /** Shared alpha access code for the AI endpoint (entered by a parent). */
  alphaToken: string;
  /** Session play-time limit in minutes; null = unlimited. */
  playTimeMinutes: number | null;
  trafficDensity: TrafficDensity;
  /** null = automatic (on for touch-first devices). */
  tiltEnabled: boolean | null;
  tiltInvert: boolean;
}

const SETTINGS_KEY = 'leo.settings';
const CALIBRATION_KEY = 'leo.defaultWheelCalibration';
const INSTALLATION_KEY = 'leo.installationId';

const DEFAULTS: Settings = {
  soundOn: true,
  worldId: 'construction',
  calibration: null,
  alphaToken: '',
  playTimeMinutes: null,
  trafficDensity: 'normal',
  tiltEnabled: null,
  tiltInvert: false,
};

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadSettings(): Settings {
  const store = storage();
  let defaultCalibration: WheelCalibration | null = null;
  try {
    const raw = store?.getItem(CALIBRATION_KEY);
    if (raw) defaultCalibration = JSON.parse(raw) as WheelCalibration;
  } catch {
    // Ignore an unavailable or corrupt backup.
  }
  try {
    const raw = store?.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS, calibration: defaultCalibration };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed, calibration: mergeCalibration(parsed.calibration ?? defaultCalibration, defaultCalibration) };
  } catch {
    return { ...DEFAULTS, calibration: defaultCalibration };
  }
}

/** Steering recalibration must keep pedal defaults for the same wheel. */
function mergeCalibration(cal: WheelCalibration | null, previous: WheelCalibration | null): WheelCalibration | null {
  if (!cal || cal.gamepadId !== previous?.gamepadId) return cal;
  return { ...previous, ...cal };
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const previous = loadSettings();
  const next = { ...previous, ...patch };
  if (patch.calibration !== undefined) next.calibration = mergeCalibration(patch.calibration, previous.calibration);
  const store = storage();
  try {
    if (next.calibration) store?.setItem(CALIBRATION_KEY, JSON.stringify(next.calibration));
    else if (patch.calibration === null) store?.removeItem(CALIBRATION_KEY);
  } catch {
    // Storage may be blocked; keep using the current in-memory calibration.
  }
  try {
    store?.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: settings simply won't persist.
  }
  return next;
}

/** Anonymous random id used only for AI quota. No personal data is ever collected. */
export function getInstallationId(): string {
  const store = storage();
  let id = store?.getItem(INSTALLATION_KEY) ?? null;
  if (!id) {
    id = crypto.randomUUID();
    try {
      store?.setItem(INSTALLATION_KEY, id);
    } catch {
      // Non-persistent id for this session.
    }
  }
  return id;
}
