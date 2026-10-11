import { App } from './game/app';

/** Boots the prototype. Pointer lock and audio require a user gesture, so the app starts from the button. */
const canvas = document.getElementById('view') as HTMLCanvasElement | null;
const hud = document.getElementById('hud');
const prompt = document.getElementById('prompt');
const menu = document.getElementById('menu');
const start = document.getElementById('start');
const startBtn = document.getElementById('start-btn');
const diag = document.createElement('pre');
diag.id = 'diag';
diag.hidden = true;
document.getElementById('app')?.appendChild(diag);
const toast = document.createElement('div');
toast.id = 'toast';
toast.className = 'toast';
toast.hidden = true;
document.getElementById('app')?.appendChild(toast);

if (!canvas || !hud || !prompt || !menu || !start || !startBtn) {
  throw new Error('Missing required page elements');
}

let app: App | null = null;
startBtn.addEventListener('click', () => {
  if (!app) {
    app = new App(canvas, { hud, diag, toast, menu });
    // F3 toggles the diagnostics overlay (available in every build; it has no gameplay effect).
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F3' && app) {
        e.preventDefault();
        app.hud.showDiagnostics = !app.hud.showDiagnostics;
      }
    });
    (window as unknown as { saltline: unknown }).saltline = {
      get sim() {
        return app?.sim;
      },
    };
  }
  start.hidden = true;
  app.start();
  canvas.requestPointerLock?.();
});
