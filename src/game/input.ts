import { ACTIONS, radialDeadzone, type Bindings } from '../sim/input-actions';
import type { Intent } from '../sim/intent';
import { clamp } from '../sim/units';

/**
 * Browser input layer. It converts keyboard, mouse, and gamepad state into a sim Intent and
 * action edges. Edge events are queued until a fixed step consumes them, so a 300 Hz display
 * does not lose presses (see the accumulator note in docs/UNITS_AND_CLOCKS.md).
 */
export interface PadState {
  connected: boolean;
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  buttons: boolean[];
  triggers: { lt: number; rt: number };
}

export class InputState {
  private readonly keysDown = new Set<string>();
  private readonly prevDown = new Set<string>();
  /** Inputs pressed since the last poll. Latched so a press and release inside one frame still counts. */
  private tapped = new Set<string>();
  /** Edge actions that fired since the last fixed step consumed them. */
  readonly pendingEdges = new Set<string>();
  bindings: Bindings;
  /** Mouse look accumulated since last read (pixels). */
  lookDx = 0;
  lookDy = 0;
  pointerLocked = false;
  /** Set by the rebind UI: next key goes to this action instead of gameplay. */
  captureFor: string | null = null;
  onCapture: ((code: string) => void) | null = null;
  /** Fired when the browser releases pointer lock (Escape in most browsers). The app opens the pause menu. */
  onLockLost: (() => void) | null = null;
  padDeadzone = 0.15;

  constructor(bindings: Bindings) {
    this.bindings = bindings;
  }

  attach(target: Window, canvas: HTMLElement): () => void {
    const kd = (e: KeyboardEvent) => {
      if (this.captureFor !== null) {
        // During a rebind every key goes to the capture callback, including Escape (which cancels).
        e.preventDefault();
        this.onCapture?.(e.code);
        return;
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.keysDown.add(e.code);
        this.tapped.add(e.code);
      }
    };
    const ku = (e: KeyboardEvent) => this.keysDown.delete(e.code);
    const md = (e: MouseEvent) => {
      if (this.captureFor !== null) {
        this.onCapture?.(`Mouse${e.button}`);
        return;
      }
      this.keysDown.add(`Mouse${e.button}`);
      this.tapped.add(`Mouse${e.button}`);
    };
    const mu = (e: MouseEvent) => this.keysDown.delete(`Mouse${e.button}`);
    const mm = (e: MouseEvent) => {
      if (this.pointerLocked) {
        this.lookDx += e.movementX;
        this.lookDy += e.movementY;
      }
    };
    const lockChange = () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      if (!this.pointerLocked) this.onLockLost?.();
    };
    const blur = () => this.keysDown.clear();
    target.addEventListener('keydown', kd);
    target.addEventListener('keyup', ku);
    target.addEventListener('mousedown', md);
    target.addEventListener('mouseup', mu);
    target.addEventListener('mousemove', mm);
    target.addEventListener('blur', blur);
    document.addEventListener('pointerlockchange', lockChange);
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    return () => {
      target.removeEventListener('keydown', kd);
      target.removeEventListener('keyup', ku);
      target.removeEventListener('mousedown', md);
      target.removeEventListener('mouseup', mu);
      target.removeEventListener('mousemove', mm);
      target.removeEventListener('blur', blur);
      document.removeEventListener('pointerlockchange', lockChange);
    };
  }

  /** Reads gamepad 0 if present. Returns a neutral state otherwise. */
  readPad(): PadState {
    const neutral: PadState = { connected: false, lx: 0, ly: 0, rx: 0, ry: 0, buttons: [], triggers: { lt: 0, rt: 0 } };
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return neutral;
    const pad = navigator.getGamepads()[0];
    if (!pad) return neutral;
    const l = radialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0, this.padDeadzone);
    const r = radialDeadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0, this.padDeadzone);
    return {
      connected: true,
      lx: l.x,
      ly: l.y,
      rx: r.x,
      ry: r.y,
      buttons: pad.buttons.map((b) => b.pressed),
      triggers: { lt: pad.buttons[6]?.value ?? 0, rt: pad.buttons[7]?.value ?? 0 },
    };
  }

  /** Is the action held (keyboard/mouse binding or fixed pad button)? */
  isDown(actionId: string, pad: PadState): boolean {
    const keys = this.bindings[actionId] ?? [];
    for (const k of keys) if (this.keysDown.has(k)) return true;
    const def = ACTIONS.find((a) => a.id === actionId);
    if (def && pad.connected) for (const b of def.pad) if (pad.buttons[b]) return true;
    return false;
  }

  /** Called once per rendered frame. Computes edges and queues them. */
  pollEdges(pad: PadState): void {
    const tapped = this.tapped;
    this.tapped = new Set();
    for (const a of ACTIONS) {
      const now = this.isDown(a.id, pad);
      const was = this.prevDown.has(a.id);
      const latched = a.keys.some((k) => tapped.has(k));
      if ((now && !was) || latched) this.pendingEdges.add(a.id);
      if (now) this.prevDown.add(a.id);
      else this.prevDown.delete(a.id);
    }
  }

  /** Builds a sim Intent. Camera-relative movement is applied for on-foot control. */
  buildIntent(pad: PadState, inVehicle: boolean, camYaw: number, consumeEdges: boolean): Intent {
    const down = (id: string) => this.isDown(id, pad);
    const fwd = (down('move_forward') ? 1 : 0) - (down('move_back') ? 1 : 0);
    const strafe = (down('move_right') ? 1 : 0) - (down('move_left') ? 1 : 0);
    const edge = (id: string) => this.pendingEdges.has(id);
    const intent: Intent = {
      moveX: 0,
      moveZ: 0,
      sprint: down('sprint'),
      jumpPressed: consumeEdges && edge('jump'),
      interactPressed: consumeEdges && edge('enter_exit'),
      hornHeld: inVehicle && down('horn'),
      headlightsPressed: consumeEdges && edge('headlights'),
      throttle: 0,
      brake: 0,
      steer: 0,
      handbrake: inVehicle && down('handbrake'),
    };
    if (inVehicle) {
      intent.throttle = clamp(Math.max(down('move_forward') ? 1 : 0, pad.triggers.rt), 0, 1);
      intent.brake = clamp(Math.max(down('move_back') ? 1 : 0, pad.triggers.lt), 0, 1);
      intent.steer = clamp(strafe + pad.lx, -1, 1);
    } else {
      // Camera-relative: forward = look direction projected on the ground.
      const sx = clamp(strafe + pad.lx, -1, 1);
      const sz = clamp(fwd - pad.ly, -1, 1);
      const m = Math.min(1, Math.hypot(sx, sz));
      const len = Math.hypot(sx, sz) || 1;
      const dx = (sx / len) * m;
      const dz = (sz / len) * m;
      // Forward = (sin yaw, cos yaw); right = (-cos yaw, sin yaw).
      intent.moveX = dz * Math.sin(camYaw) + dx * -Math.cos(camYaw);
      intent.moveZ = dz * Math.cos(camYaw) + dx * Math.sin(camYaw);
    }
    return intent;
  }

  /** Clears queued edges after a step consumed them. */
  consumeEdges(): void {
    this.pendingEdges.clear();
  }
}
