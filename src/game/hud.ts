import type { SaltlineSim } from '../sim/game';
import { mpsToKmh } from '../sim/units';
import { ON_FOOT_TUNING } from '../sim/player';
import type { Settings } from '../sim/settings';

export interface HudDiagnostics {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  meshes: number;
  pendingBuilds: number;
  stepsPerSecond: number;
  coverageOk: boolean;
  colliderCells: number;
}

/** DOM HUD. Reads sim state only. All status is shown as text, not colour alone (brief §46). */
export class Hud {
  private readonly root: HTMLElement;
  private readonly diag: HTMLElement;
  private readonly toast: HTMLElement;
  private toastUntil = 0;
  private lastRender = 0;
  showDiagnostics = false;

  constructor(root: HTMLElement, diag: HTMLElement, toast: HTMLElement) {
    this.root = root;
    this.diag = diag;
    this.toast = toast;
  }

  applySettings(s: Settings): void {
    const style = document.documentElement.style;
    style.setProperty('--hud-scale', String(s.hudScale));
    style.setProperty('--text-scale', String(s.textScale));
  }

  say(message: string, ms = 2600): void {
    this.toast.textContent = message;
    this.toast.hidden = false;
    this.toastUntil = performance.now() + ms;
  }

  render(sim: SaltlineSim, objective: string, prompt: string | null, padConnected: boolean, now: number): void {
    if (now - this.lastRender < 100) return;
    this.lastRender = now;
    const hour = sim.clock.hour;
    const hh = Math.floor(hour);
    const mm = Math.floor((hour - hh) * 60);
    const eli = sim.characters[sim.activeCharacterId];
    const cash = eli ? eli.cash : 0;
    const hp = sim.mode === 'in_vehicle' ? sim.car.health / 10 : sim.player.health;
    const stamina = sim.player.stamina / ON_FOOT_TUNING.staminaMax * 100;
    const kmh = Math.round(Math.abs(mpsToKmh(sim.car.v)));
    this.root.innerHTML = `
      <div class="hud-tl">
        <div class="clock">${pad2(hh)}:${pad2(mm)}</div>
        <div class="zone">Saltline · Test District</div>
        <div class="char">Eli Mercer <span class="tag">blue · temp name</span></div>
      </div>
      <div class="hud-tr"><div class="cash">$${cash.toLocaleString('en-US')}</div><div class="wanted" title="Wanted system not implemented (Milestone B)">Wanted: not in this build</div></div>
      <div class="hud-bl">
        <div class="bar"><span class="lbl">${sim.mode === 'in_vehicle' ? 'VEHICLE' : 'HEALTH'} ${Math.round(hp)}%</span><div class="track"><div class="fill hp" style="width:${clampPct(hp)}%"></div></div></div>
        ${sim.mode === 'on_foot' ? `<div class="bar"><span class="lbl">STAMINA ${Math.round(stamina)}%</span><div class="track"><div class="fill st" style="width:${clampPct(stamina)}%"></div></div></div>` : ''}
      </div>
      ${sim.mode === 'in_vehicle'
        ? `<div class="hud-br"><div class="speed">${kmh}<small> km/h</small></div><div class="flags">${sim.car.hornOn ? '<span>HORN</span>' : ''}${sim.car.headlights ? '<span>LIGHTS</span>' : ''}${intentHandbrakeLabel(sim)}</div></div>`
        : ''}
      <div class="hud-objective">${escapeHtml(objective)}</div>
      ${prompt ? `<div class="hud-prompt">${escapeHtml(prompt)}</div>` : ''}
      ${padConnected ? '<div class="hud-pad">Controller connected</div>' : ''}
    `;
    this.root.style.display = '';
    if (this.showDiagnostics) this.diag.hidden = false;
    if (!this.showDiagnostics) this.diag.hidden = true;
    if (this.toastUntil > 0 && now > this.toastUntil) {
      this.toast.hidden = true;
      this.toastUntil = 0;
    }
  }

  renderDiagnostics(d: HudDiagnostics): void {
    if (!this.showDiagnostics) return;
    this.diag.textContent = [
      `fps ${d.fps.toFixed(0)}  frame ${d.frameMs.toFixed(1)} ms`,
      `sim steps/s ${d.stepsPerSecond}`,
      `cells ${d.colliderCells} (meshes ${d.meshes}, queued ${d.pendingBuilds})`,
      `draw calls ${d.drawCalls}  tris ${d.triangles}`,
      `collision coverage ${d.coverageOk ? 'OK' : 'MISSING'}`,
    ].join('\n');
  }
}

function intentHandbrakeLabel(sim: SaltlineSim): string {
  return Math.abs(sim.car.v) > 0.5 && Math.abs(sim.car.u) > 1.0 ? '<span>SLIDE</span>' : '';
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function clampPct(v: number): number {
  return Math.max(0, Math.min(100, v));
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
