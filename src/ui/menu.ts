import { ACTIONS, findConflicts, rebind, defaultBindings, type Bindings } from '../sim/input-actions';
import { DEFAULT_SETTINGS, type Settings } from '../sim/settings';
import { escapeHtml } from '../game/hud';

/**
 * Pause menu: resume, slot save/load, settings, and rebinding. Rebinding captures the next key press
 * through InputState.captureFor (the caller wires that up through callbacks).
 */
export interface MenuCallbacks {
  onResume(): void;
  onSave(): void;
  onLoad(): void;
  onSettingsChanged(s: Settings): void;
  onBeginCapture(actionId: string, done: (code: string | null) => void): void;
}

export class PauseMenu {
  private page: 'main' | 'settings' | 'controls' = 'main';
  private status = '';
  open = false;
  constructor(
    private readonly root: HTMLElement,
    private settings: Settings,
    private readonly cb: MenuCallbacks,
  ) {}

  setSettings(s: Settings): void {
    this.settings = s;
  }

  show(status = ''): void {
    this.open = true;
    this.status = status;
    this.root.hidden = false;
    this.render();
  }

  hide(): void {
    this.open = false;
    this.root.hidden = true;
  }

  setStatus(text: string): void {
    this.status = text;
    if (this.open) this.render();
  }

  private render(): void {
    const body =
      this.page === 'main'
        ? `<h2>Paused</h2>
           <div class="btns">
             <button data-act="resume" type="button">Resume</button>
             <button data-act="save" type="button">Save game (slot 1)</button>
             <button data-act="load" type="button">Load game (slot 1)</button>
             <button data-act="settings" type="button">Settings</button>
             <button data-act="controls" type="button">Controls and rebinding</button>
           </div>`
        : this.page === 'settings'
          ? this.settingsHtml()
          : this.controlsHtml();
    this.root.innerHTML = `<div class="card wide">${body}<p class="status" role="status">${escapeHtml(this.status)}</p></div>`;
    this.root.querySelectorAll<HTMLButtonElement>('button[data-act]').forEach((b) => {
      b.addEventListener('click', () => this.onAct(b.dataset.act ?? ''));
    });
    this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-setting]').forEach((el) => {
      el.addEventListener('change', () => this.onSetting(el));
    });
    this.root.querySelectorAll<HTMLButtonElement>('button[data-rebind]').forEach((b) => {
      b.addEventListener('click', () => this.beginRebind(b.dataset.rebind ?? ''));
    });
  }

  private onAct(act: string): void {
    switch (act) {
      case 'resume':
        this.cb.onResume();
        break;
      case 'save':
        this.cb.onSave();
        break;
      case 'load':
        this.cb.onLoad();
        break;
      case 'settings':
        this.page = 'settings';
        this.render();
        break;
      case 'controls':
        this.page = 'controls';
        this.render();
        break;
      case 'back':
        this.page = 'main';
        this.render();
        break;
      case 'reset-bindings':
        this.commit({ ...this.settings, bindings: defaultBindings() });
        break;
      case 'reset-settings':
        this.commit({ ...DEFAULT_SETTINGS, bindings: this.settings.bindings });
        break;
    }
  }

  private onSetting(el: HTMLInputElement | HTMLSelectElement): void {
    const key = el.dataset.setting as keyof Settings;
    let value: unknown;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') value = el.checked;
    else if (el instanceof HTMLInputElement && el.type === 'range') value = Number(el.value);
    else value = el.value;
    this.commit({ ...this.settings, [key]: value } as Settings);
  }

  private commit(next: Settings): void {
    this.settings = next;
    this.cb.onSettingsChanged(next);
    this.render();
  }

  private beginRebind(actionId: string): void {
    this.setStatus(`Press a key for "${ACTIONS.find((a) => a.id === actionId)?.label ?? actionId}" (Esc cancels).`);
    this.cb.onBeginCapture(actionId, (code) => {
      if (code === null) {
        this.setStatus('Rebind cancelled.');
        return;
      }
      const r = rebind(this.settings.bindings as Bindings, actionId, code);
      const notes = r.displaced.length ? ` Removed ${code} from: ${r.displaced.join(', ')}.` : '';
      this.commit({ ...this.settings, bindings: r.bindings });
      this.setStatus(`Bound ${code} to ${actionId}.${notes}`);
    });
  }

  private settingsHtml(): string {
    const s = this.settings;
    const range = (key: string, label: string, min: number, max: number, step: number, value: number) =>
      `<label>${label}<input type="range" data-setting="${key}" min="${min}" max="${max}" step="${step}" value="${value}" /><output>${value}</output></label>`;
    return `<h2>Settings</h2>
      <div class="grid">
        ${range('mouseSensitivity', 'Mouse sensitivity', 0.05, 3, 0.05, s.mouseSensitivity)}
        <label><input type="checkbox" data-setting="invertY" ${s.invertY ? 'checked' : ''} /> Invert vertical look</label>
        ${range('padLookSensitivity', 'Controller look sensitivity', 0.2, 3, 0.1, s.padLookSensitivity)}
        ${range('stickDeadzone', 'Stick dead zone', 0, 0.5, 0.01, s.stickDeadzone)}
        <label><input type="checkbox" data-setting="vibration" ${s.vibration ? 'checked' : ''} /> Controller vibration</label>
        ${range('fov', 'Field of view', 50, 90, 1, s.fov)}
        ${range('hudScale', 'HUD scale', 0.8, 1.4, 0.05, s.hudScale)}
        ${range('textScale', 'Text size', 0.8, 1.6, 0.05, s.textScale)}
        <label><input type="checkbox" data-setting="subtitles" ${s.subtitles ? 'checked' : ''} /> Show objective and prompt text</label>
        <label>Camera distance <select data-setting="cameraDistance">
          ${(['near', 'mid', 'far'] as const).map((v) => `<option value="${v}" ${s.cameraDistance === v ? 'selected' : ''}>${v}</option>`).join('')}
        </select></label>
        <label><input type="checkbox" data-setting="firstPersonHeadBob" ${s.firstPersonHeadBob ? 'checked' : ''} /> First-person head bob</label>
      </div>
      <div class="btns row">
        <button data-act="back" type="button">Back</button>
        <button data-act="reset-settings" type="button">Reset settings to defaults</button>
      </div>`;
  }

  private controlsHtml(): string {
    const conflicts = findConflicts(this.settings.bindings);
    const rows = ACTIONS.map(
      (a) => `<tr>
        <td>${escapeHtml(a.label)}${a.implemented ? '' : ' <em>(not implemented yet)</em>'}</td>
        <td>${escapeHtml(a.context)}</td>
        <td><code>${escapeHtml((this.settings.bindings[a.id] ?? []).join(', ') || '—')}</code></td>
        <td><button data-rebind="${a.id}" type="button">Rebind</button></td>
      </tr>`,
    ).join('');
    const warn = conflicts.length
      ? `<p class="warn">Conflicts: ${conflicts.map((c) => `${c.key} (${c.actions.join(' / ')})`).join('; ')}</p>`
      : '<p class="ok">No conflicting bindings.</p>';
    return `<h2>Controls</h2>${warn}
      <div class="scroll"><table><thead><tr><th>Action</th><th>Context</th><th>Key</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="hint">Gamepad bindings are fixed in this build (controller rebinding is a gap). Settings save automatically.</p>
      <div class="btns row"><button data-act="back" type="button">Back</button><button data-act="reset-bindings" type="button">Reset bindings</button></div>`;
  }
}
