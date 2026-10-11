import * as THREE from 'three';
import { SaltlineSim, type SimEvent } from '../sim/game';
import { FIXED_DT, clamp, lerp } from '../sim/units';
import { SaveManager, sealSave, type SaveV1 } from '../sim/save';
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from '../sim/settings';
import { defaultBindings } from '../sim/input-actions';
import { InputState, type PadState } from './input';
import { CameraRig } from './camera-rig';
import { WorldView } from './world-view';
import { CarView, FigureView } from './actors';
import { Hud, type HudDiagnostics } from './hud';
import { openBrowserStore, SETTINGS_KEY } from './storage';
import { PauseMenu } from '../ui/menu';
import { getCharacterRecord } from '../sim/content';


const SLOT = 1;
const OBJECTIVE_ON_FOOT = 'Walk to the Kestrel GT parked on the east curb and press F to get in.';
const OBJECTIVE_IN_CAR = 'Drive around the district. Stop (under 1 m/s) and press F to get out.';

/**
 * Application shell. Owns the simulation, renderer, input, HUD, menu, and persistence.
 * The frame loop: input edges -> fixed sim steps -> sim events -> mesh streaming -> render -> HUD.
 */
export class App {
  readonly sim: SaltlineSim;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(65, 1, 0.1, 3000);
  readonly rig: CameraRig;
  readonly input: InputState;
  readonly worldView: WorldView;
  readonly figure: FigureView;
  readonly carView: CarView;
  readonly hud: Hud;
  readonly menu: PauseMenu;
  readonly saves: SaveManager;
  settings: Settings;
  persistent = true;

  private readonly sun: THREE.DirectionalLight;
  private readonly ambient: THREE.HemisphereLight;
  private started = false;
  private lastFrame = 0;
  private detachInput: (() => void) | null = null;
  private stepCount = 0;
  private stepWindowStart = 0;
  private stepsPerSecond = 0;
  private frameTimes: number[] = [];
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, ui: { hud: HTMLElement; diag: HTMLElement; toast: HTMLElement; menu: HTMLElement }) {
    this.canvas = canvas;
    const { store, persistent } = openBrowserStore();
    this.persistent = persistent;
    this.saves = new SaveManager(store);
    this.settings = this.loadSettings(store);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.scene.fog = new THREE.Fog(0x8ec5ff, 250, 1400);
    this.ambient = new THREE.HemisphereLight(0xdfeaff, 0x5a5447, 0.9);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.2);
    this.scene.add(this.ambient, this.sun);

    this.sim = new SaltlineSim({ seed: 20261011 });
    this.rig = new CameraRig(this.camera);
    this.input = new InputState(this.settings.bindings ?? defaultBindings());
    this.input.padDeadzone = this.settings.stickDeadzone;
    this.worldView = new WorldView(this.scene, this.sim);
    this.figure = new FigureView(getCharacterRecord(this.sim.activeCharacterId).color === 'blue' ? 0x2d6fd6 : 0x888888);
    this.scene.add(this.figure.group);
    this.carView = new CarView();
    this.scene.add(this.carView.group);

    this.hud = new Hud(ui.hud, ui.diag, ui.toast);
    this.hud.applySettings(this.settings);
    this.menu = new PauseMenu(ui.menu, this.settings, {
      onResume: () => this.resume(),
      onSave: () => this.quickSave(),
      onLoad: () => this.quickLoad(),
      onSettingsChanged: (s) => this.applySettings(s),
      onBeginCapture: (actionId, done) => {
        this.input.captureFor = actionId;
        this.input.onCapture = (code) => {
          this.input.captureFor = null;
          this.input.onCapture = null;
          done(code === 'Escape' ? null : code);
        };
      },
    });
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private loadSettings(store: { getItem(k: string): string | null }): Settings {
    try {
      const raw = store.getItem(SETTINGS_KEY);
      return raw ? sanitizeSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS, bindings: defaultBindings() };
    } catch {
      return { ...DEFAULT_SETTINGS, bindings: defaultBindings() };
    }
  }

  private applySettings(s: Settings): void {
    this.settings = sanitizeSettings(s);
    this.input.bindings = this.settings.bindings;
    this.input.padDeadzone = this.settings.stickDeadzone;
    this.hud.applySettings(this.settings);
    this.menu.setSettings(this.settings);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      this.hud.say('Settings could not be saved (storage unavailable). They apply for this session only.');
    }
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  /** Starts the loop and input. Must be called from a user gesture to allow pointer lock. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.detachInput = this.input.attach(window, this.canvas);
    // Browsers release pointer lock on Escape; treat that as a request for the pause menu.
    this.input.onLockLost = () => {
      if (this.started && !this.menu.open) this.pause();
    };
    this.canvas.addEventListener('click', () => {
      if (!this.menu.open && !this.input.pointerLocked) this.canvas.requestPointerLock?.();
    });
    this.lastFrame = performance.now();
    this.stepWindowStart = this.lastFrame;
    this.hud.say(this.persistent ? 'Playing. Esc opens the pause menu.' : 'Playing. Storage is unavailable; saves will not persist.');
    requestAnimationFrame((t) => this.frame(t));
  }

  stop(): void {
    this.detachInput?.();
    this.started = false;
  }

  private pause(): void {
    this.sim.clock.paused = true;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.menu.show('Game paused. Simulation is frozen; the save file is unchanged.');
  }

  private resume(): void {
    this.sim.clock.paused = false;
    this.menu.hide();
    this.canvas.requestPointerLock?.();
  }

  quickSave(): void {
    if (this.sim.mode === 'in_vehicle' && Math.abs(this.sim.car.v) > 1) {
      this.menu.setStatus('Stop the car before saving.');
      this.hud.say('Stop the car before saving.');
      return;
    }
    try {
      const save = sealSave(this.sim.snapshot() as Omit<SaveV1, 'checksum'>);
      this.saves.write(SLOT, save);
      this.menu.setStatus(`Saved to slot ${SLOT} at in-game ${this.clockText()}.`);
      this.hud.say(`Game saved (slot ${SLOT}).`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.menu.setStatus(`Save failed: ${msg}`);
      this.hud.say('Save failed. Your previous save is unchanged.');
    }
  }

  quickLoad(): void {
    const out = this.saves.read(SLOT);
    if (!out.result.ok) {
      this.menu.setStatus(`Load failed: ${out.result.error}`);
      this.hud.say('No readable save in slot 1.');
      return;
    }
    this.sim.restore(out.result.save);
    this.resyncWorldView();
    this.figure.setVisible(true);
    const note = out.result.warnings.length ? ` (${out.result.warnings.join('; ')})` : '';
    this.menu.setStatus(`Loaded slot ${SLOT}.${note}`);
    this.hud.say(`Game loaded (slot ${SLOT}).`);
  }

  private resyncWorldView(): void {
    this.worldView.dispose();
    for (const [cx, cz] of this.sim.streamer.residentKeys.map((k) => k.split(',').map(Number) as [number, number])) {
      this.worldView.enqueue(cx, cz);
    }
  }

  private clockText(): string {
    const h = this.sim.clock.hour;
    return `${Math.floor(h).toString().padStart(2, '0')}:${Math.floor((h % 1) * 60).toString().padStart(2, '0')}`;
  }

  private processSimEvents(events: SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'cell_loaded') this.worldView.enqueue(e.cx, e.cz);
      else if (e.type === 'cell_unloaded') this.worldView.remove(e.cx, e.cz);
      else if (e.type === 'entered_vehicle') this.hud.say('Engine running. Drive with W/A/S/D, Space for handbrake.');
      else if (e.type === 'exited_vehicle') this.hud.say('Out of the car.');
      else if (e.type === 'landed' && e.impact > 6) this.hud.say('Hard landing.', 1200);
      else if (e.type === 'car_impact') this.hud.say(`Impact at ${Math.round(e.speed * 3.6)} km/h.`, 1200);
    }
  }

  private objectiveText(): string {
    return this.sim.mode === 'in_vehicle' ? OBJECTIVE_IN_CAR : OBJECTIVE_ON_FOOT;
  }

  private promptText(): string | null {
    if (this.sim.mode === 'in_vehicle') {
      return Math.abs(this.sim.car.v) < 1 ? 'F — Get out' : 'Slow down to get out';
    }
    if (this.sim.canEnterCar()) return 'F — Get in Kestrel GT';
    if (this.sim.car.health <= 0) return 'Kestrel GT is wrecked';
    return null;
  }

  private frame(now: number): void {
    if (!this.started) return;
    const realDt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    this.frameTimes.push(realDt * 1000);
    if (this.frameTimes.length > 120) this.frameTimes.shift();

    const pad = this.input.readPad();
    this.input.pollEdges(pad);

    // UI edges are handled immediately, not on the sim schedule.
    if (this.input.pendingEdges.has('pause')) {
      this.input.pendingEdges.delete('pause');
      if (this.menu.open) this.resume();
      else this.pause();
    }
    if (!this.menu.open) {
      if (this.input.pendingEdges.has('camera_view')) {
        this.input.pendingEdges.delete('camera_view');
        this.rig.firstPerson = !this.rig.firstPerson;
        this.hud.say(this.rig.firstPerson ? 'First-person view' : 'Third-person view', 1200);
      }
      if (this.input.pendingEdges.has('quick_save')) {
        this.input.pendingEdges.delete('quick_save');
        this.quickSave();
      }
      if (this.input.pendingEdges.has('quick_load')) {
        this.input.pendingEdges.delete('quick_load');
        this.quickLoad();
      }

      // Mouse and gamepad look.
      if (this.input.pointerLocked || pad.connected) {
        this.rig.look(this.input.lookDx, this.input.lookDy, this.settings.mouseSensitivity, this.settings.invertY);
        this.rig.look(pad.rx * 16 * this.settings.padLookSensitivity * realDt, pad.ry * 16 * this.settings.padLookSensitivity * realDt, 1, this.settings.invertY);
      }
      this.input.lookDx = 0;
      this.input.lookDy = 0;
    } else {
      this.input.lookDx = 0;
      this.input.lookDy = 0;
    }

    if (!this.menu.open) {
      const steps = this.sim.clock.advanceReal(realDt);
      for (let i = 0; i < steps; i++) {
        const intent = this.input.buildIntent(pad, this.sim.mode === 'in_vehicle', this.rig.yaw, i === 0);
        this.sim.step(intent, FIXED_DT);
        this.stepCount++;
      }
      if (steps > 0) this.input.consumeEdges();
    } else {
      this.sim.clock.advanceReal(realDt);
    }

    this.processSimEvents(this.sim.drainEvents());
    this.worldView.pump();
    this.syncActors(realDt);
    this.updateCamera(realDt);
    this.updateSky();
    this.renderer.render(this.scene, this.camera);

    this.updateHud(now);
    requestAnimationFrame((t) => this.frame(t));
  }

  private syncActors(dt: number): void {
    const moving = Math.hypot(this.sim.player.vx, this.sim.player.vz) > 0.2;
    this.figure.sync(this.sim.player, moving && this.sim.mode === 'on_foot', dt);
    this.figure.setVisible(this.sim.mode === 'on_foot');
    this.carView.sync(this.sim.car);
  }

  private updateCamera(dt: number): void {
    const inCar = this.sim.mode === 'in_vehicle';
    const target = inCar ? { x: this.sim.car.x, y: 0, z: this.sim.car.z } : { x: this.sim.player.x, y: this.sim.player.y, z: this.sim.player.z };
    // On foot in first person, the body turns to face the camera (movement is camera-relative).
    if (!inCar && this.rig.firstPerson) this.sim.player.yaw = this.rig.yaw;
    const boxes = this.sim.colliders.query(target.x - 12, target.z - 12, target.x + 12, target.z + 12, []);
    for (const b of this.sim.boundaryBoxes) boxes.push(b);
    this.rig.update(this.settings, target, dt, boxes, { active: inCar, yaw: this.sim.car.yaw }, true);
  }

  private updateSky(): void {
    const h = this.sim.clock.hour;
    const theta = ((h - 6) / 24) * Math.PI * 2;
    const elev = Math.sin(theta);
    const dist = 600;
    this.sun.position.set(Math.cos(theta) * dist * 0.5, Math.max(0.05, elev) * dist, dist * 0.35);
    this.sun.target.position.set(0, 0, 0);
    this.sun.intensity = clamp(elev * 1.3, 0, 1.2);
    this.ambient.intensity = lerp(0.25, 0.9, clamp(elev * 1.5 + 0.4, 0, 1));
    const day = new THREE.Color(0x8ec5ff);
    const night = new THREE.Color(0x0b1224);
    const dusk = new THREE.Color(0xf08a5d);
    const t = clamp(elev * 1.5 + 0.5, 0, 1);
    const sky = night.clone().lerp(day, t);
    const twilight = clamp(1 - Math.abs(elev) * 4, 0, 1);
    sky.lerp(dusk, twilight * 0.6);
    this.scene.background = sky;
    (this.scene.fog as THREE.Fog).color.copy(sky);
  }

  private updateHud(now: number): void {
    const pad = this.input.readPad();
    const prompt = this.promptText();
    this.hud.render(this.sim, this.objectiveText(), prompt, pad.connected, now);
    if (now - this.stepWindowStart >= 1000) {
      this.stepsPerSecond = this.stepCount;
      this.stepCount = 0;
      this.stepWindowStart = now;
    }
    if (this.hud.showDiagnostics) {
      const avgMs = this.frameTimes.reduce((a, b) => a + b, 0) / Math.max(1, this.frameTimes.length);
      const info = this.renderer.info;
      const d: HudDiagnostics = {
        fps: avgMs > 0 ? 1000 / avgMs : 0,
        frameMs: avgMs,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        meshes: this.worldView.loadedMeshCount,
        pendingBuilds: this.worldView.pendingBuilds,
        stepsPerSecond: this.stepsPerSecond,
        coverageOk: this.sim.collisionCoverageOk(),
        colliderCells: this.sim.colliders.loadedCount,
      };
      this.hud.renderDiagnostics(d);
    }
  }

  /** Test hook: runs N simulation steps with no rendering. Used by browser smoke tests. */
  debugAdvance(steps: number): void {
    for (let i = 0; i < steps; i++) this.sim.step({ ...this.input.buildIntent(this.input.readPad(), false, 0, false) }, FIXED_DT);
  }

}
