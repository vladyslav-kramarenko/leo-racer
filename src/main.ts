import './styles.css';
import { AudioManager } from './audio/AudioManager';
import { DrawingManager } from './drawings/DrawingManager';
import { effectiveCanMove } from './drawings/DrawingStorage';
import { Game } from './game/Game';
import { loadSettings, saveSettings } from './storage/settings';
import { DiagnosticsOverlay } from './ui/DiagnosticsOverlay';
import { createAddDrawingScreen, createManageDrawingsScreen } from './ui/DrawingDialog';
import { downloadJson } from './ui/dom';
import { ParentGesture, ParentMenu } from './ui/ParentMenu';
import { StartScreen } from './ui/StartScreen';
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
  let settings = loadSettings();
  const preset = getPreset(settings.worldId);
  const audio = new AudioManager();
  audio.setEnabled(settings.soundOn);

  let game: Game;
  try {
    game = new Game(root, preset, audio);
  } catch (err) {
    console.error(err);
    showFatal(root, 'Leo Racer needs WebGL. Please try an up-to-date Chrome, Edge or Firefox.');
    return;
  }
  game.setCalibration(settings.calibration);
  game.boot();

  // CREATE layer → WORLD: drawings become sprite sources.
  const drawings = new DrawingManager();
  drawings.subscribe((assets, added) => {
    game.setDrawings(assets.map((a) => ({ id: a.id, image: a.processedImage, moves: effectiveCanMove(a) })));
    if (added) game.showDrawingSoon(added.id);
  });
  void drawings.load();

  const diagnostics = new DiagnosticsOverlay(() => game.getLive());
  diagnostics.mount(root);

  const collectDiagnostics = () =>
    game.metrics.export({
      drawings: drawings.list().length,
      inputSources: game.input.getUsedSources(),
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
      worlds: () => listPresets().map((p) => ({ id: p.id, name: p.name })),
      currentWorld: () => preset.id,
      drawingCount: () => drawings.list().length,
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
    game.startDriving();
    start.hide();
    // Parent gestures only once driving started, so the start screen stays simple.
    new ParentGesture(menu).attach(root);
  });
  start.mount(root);

  const params = new URLSearchParams(location.search);
  if (import.meta.env.DEV) {
    (window as unknown as { __leo: unknown }).__leo = {
      state: () => game.debugState(),
      live: () => game.getLive(),
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
