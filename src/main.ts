import './styles.css';
import { AudioManager } from './audio/AudioManager';
import { DrawingManager } from './drawings/DrawingManager';
import { effectiveCanMove } from './drawings/DrawingStorage';
import { Game } from './game/Game';
import { TiltInput } from './input/TiltInput';
import { loadSettings, saveSettings } from './storage/settings';
import { DiagnosticsOverlay } from './ui/DiagnosticsOverlay';
import { createAddDrawingScreen, createManageDrawingsScreen } from './ui/DrawingDialog';
import { downloadJson } from './ui/dom';
import { EndScreen } from './ui/EndScreen';
import { ParentGesture, ParentMenu, type TiltStatus } from './ui/ParentMenu';
import { StartScreen } from './ui/StartScreen';
import { TouchBrakeIndicator } from './ui/TouchBrakeIndicator';
import { createWheelSetupScreen } from './ui/WheelSetup';
import { getPreset, listPresets } from './world/presets';

function showFatal(root: HTMLElement, message: string): void {
  root.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'fatal';
  box.textContent = message;
  root.append(box);
}

async function main(): Promise<void> {
  const root = document.getElementById('app')!;
  const params = new URLSearchParams(location.search);
  let settings = loadSettings();
  const preset = getPreset(settings.worldId);
  const audio = new AudioManager();
  audio.setEnabled(settings.soundOn);

  let game: Game;
  try {
    game = new Game(root, preset, audio, {
      playTimeMinutes: settings.playTimeMinutes,
      trafficDensity: settings.trafficDensity,
      // Test hook: shorten the ending sequence in development only.
      endingDurationMs: import.meta.env.DEV && params.has('endingMs') ? Number(params.get('endingMs')) : undefined,
    });
  } catch (err) {
    console.error(err);
    showFatal(root, 'Leo Racer needs WebGL. Please try an up-to-date Chrome, Edge or Firefox.');
    return;
  }
  game.setCalibration(settings.calibration);
  game.input.tilt.setInverted(settings.tiltInvert);
  game.boot();

  // CREATE layer → WORLD: drawings become sprite sources.
  const drawings = new DrawingManager();
  drawings.subscribe((assets, added) => {
    game.setDrawings(
      assets.map((a) => ({ id: a.id, image: a.processedImage, moves: effectiveCanMove(a), frequency: a.frequency ?? 'normal' })),
    );
    if (added) game.showDrawingSoon(added.id);
  });
  void drawings.load();

  const diagnostics = new DiagnosticsOverlay(() => game.getLive());
  diagnostics.mount(root);

  const brakeIndicator = new TouchBrakeIndicator();
  brakeIndicator.mount(root);
  game.input.touchBrake.onChange((braking) => brakeIndicator.setVisible(braking));

  const endScreen = new EndScreen();
  endScreen.mount(root);
  game.onSessionPhase((phase) => {
    if (phase === 'finished') endScreen.show();
    else if (phase === 'running') endScreen.hide();
  });

  // Tilt: automatic on touch-first devices unless the parent decided otherwise.
  let tiltFailed = false;
  const wantsTilt = () => settings.tiltEnabled ?? TiltInput.isTouchFirst();
  const enableTilt = async (): Promise<TiltStatus> => {
    const ok = await game.input.tilt.enable();
    tiltFailed = !ok;
    return ok ? 'on' : 'unavailable';
  };
  const tiltStatus = (): TiltStatus => (game.input.tilt.isEnabled() ? 'on' : tiltFailed ? 'unavailable' : 'off');

  const collectDiagnostics = () =>
    game.metrics.export({
      drawings: drawings.list().length,
      inputSources: game.input.getUsedSources(),
      tiltUsed: game.input.getUsedSources().includes('tilt'),
      touchBrakeUsed: game.input.touchBrake.wasUsed(),
      takeovers: game.getTakeoverCounts(),
      sessionPhase: game.session.phase,
      playTimeMinutes: settings.playTimeMinutes,
      world: preset.id,
      live: game.getLive(),
      userAgent: navigator.userAgent,
    });

  const menu = new ParentMenu(
    {
      pause: () => {
        game.setPaused(true);
        audio.setDucked(true);
      },
      resume: () => {
        game.setPaused(false);
        audio.setDucked(false);
      },
      isSoundOn: () => settings.soundOn,
      setSound: (on) => {
        settings = saveSettings({ soundOn: on });
        audio.setEnabled(on);
      },
      isFullscreen: () => !!document.fullscreenElement,
      toggleFullscreen: () => void toggleFullscreen(),
      isDiagnosticsVisible: () => diagnostics.isVisible(),
      setDiagnosticsVisible: (v) => diagnostics.setVisible(v),
      exportDiagnostics: () => downloadJson(`leo-racer-diagnostics-${Date.now()}.json`, collectDiagnostics()),
      copyDiagnostics: async () => {
        try {
          await navigator.clipboard.writeText(JSON.stringify(collectDiagnostics(), null, 2));
          return true;
        } catch {
          return false;
        }
      },
      worlds: () => listPresets().map((p) => ({ id: p.id, name: p.name, thumbnail: p.thumbnail })),
      currentWorld: () => preset.id,
      selectWorld: (id) => {
        if (id === preset.id) return;
        settings = saveSettings({ worldId: id });
        // Reload instead of hot-swapping Three.js resources: no disposal bugs, no stale state.
        location.reload();
      },
      drawingCount: () => drawings.list().length,
      playTimeMinutes: () => settings.playTimeMinutes,
      setPlayTimeMinutes: (minutes) => {
        settings = saveSettings({ playTimeMinutes: minutes });
        game.setPlayTimeMinutes(minutes);
      },
      sessionPhase: () => game.session.phase,
      startAnotherSession: () => game.restartSession(),
      trafficDensity: () => settings.trafficDensity,
      setTrafficDensity: (density) => {
        settings = saveSettings({ trafficDensity: density });
        game.setTrafficDensity(density);
      },
      tiltStatus,
      setTiltEnabled: async (enabled) => {
        settings = saveSettings({ tiltEnabled: enabled });
        if (!enabled) {
          game.input.tilt.disable();
          tiltFailed = false;
          return 'off';
        }
        return enableTilt();
      },
      recenterTilt: () => game.input.tilt.recenter(),
      isTiltInverted: () => settings.tiltInvert,
      setTiltInverted: (inverted) => {
        settings = saveSettings({ tiltInvert: inverted });
        game.input.tilt.setInverted(inverted);
      },
    },
    {
      addDrawing: createAddDrawingScreen(drawings),
      manageDrawings: createManageDrawingsScreen(drawings),
      calibrateWheel: createWheelSetupScreen(game.input.gamepad, (cal) => {
        settings = saveSettings({ calibration: cal });
        game.setCalibration(cal);
      }),
    },
  );
  menu.mount(root);

  const start = new StartScreen((fullscreen) => {
    if (fullscreen) void toggleFullscreen();
    audio.start(preset.audio);
    // Must run inside the click: iOS only grants motion permission from a user gesture.
    if (wantsTilt()) void enableTilt();
    game.startDriving();
    start.hide();
    // Parent gestures only once driving started, so the start screen stays simple.
    new ParentGesture(menu).attach(root);
  });
  start.mount(root);

  if (import.meta.env.DEV) {
    (window as unknown as { __leo: unknown }).__leo = {
      state: () => game.debugState(),
      live: () => game.getLive(),
      endSession: () => game.beginEndingSequence(),
    };
    if (params.has('debug')) diagnostics.setVisible(true);
  }
}

async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    // Fullscreen is optional.
  }
}

void main();
