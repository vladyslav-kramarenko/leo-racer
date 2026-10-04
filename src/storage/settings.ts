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
  try {
    const raw = storage()?.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...patch };
  try {
    storage()?.setItem(SETTINGS_KEY, JSON.stringify(next));
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
