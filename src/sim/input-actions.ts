/**
 * Action registry for keyboard/mouse and gamepad (brief §6).
 * Keys use KeyboardEvent.code values; mouse buttons use "Mouse0"/"Mouse1"/"Mouse2".
 * Gamepad buttons use the W3C "standard" mapping index.
 * `implemented: false` actions are listed so the control guide stays honest; they have no gameplay yet.
 */
export type ActionContext = 'global' | 'on_foot' | 'vehicle';

export interface ActionDef {
  id: string;
  label: string;
  context: ActionContext;
  keys: string[];
  pad: number[];
  implemented: boolean;
  /** Hold/tap/repeat behaviour (brief §6). Only 'tap' is implemented; others are gaps. */
  press: 'tap' | 'hold' | 'double_tap' | 'repeat';
}

export const ACTIONS: readonly ActionDef[] = [
  { id: 'move_forward', label: 'Move forward / throttle', context: 'global', keys: ['KeyW', 'ArrowUp'], pad: [], implemented: true, press: 'hold' },
  { id: 'move_back', label: 'Move back / brake / reverse', context: 'global', keys: ['KeyS', 'ArrowDown'], pad: [], implemented: true, press: 'hold' },
  { id: 'move_left', label: 'Move left / steer left', context: 'global', keys: ['KeyA', 'ArrowLeft'], pad: [], implemented: true, press: 'hold' },
  { id: 'move_right', label: 'Move right / steer right', context: 'global', keys: ['KeyD', 'ArrowRight'], pad: [], implemented: true, press: 'hold' },
  { id: 'sprint', label: 'Sprint', context: 'on_foot', keys: ['ShiftLeft'], pad: [10], implemented: true, press: 'hold' },
  { id: 'jump', label: 'Jump', context: 'on_foot', keys: ['Space'], pad: [0], implemented: true, press: 'tap' },
  { id: 'handbrake', label: 'Handbrake', context: 'vehicle', keys: ['Space'], pad: [1], implemented: true, press: 'hold' },
  { id: 'enter_exit', label: 'Enter / exit vehicle', context: 'global', keys: ['KeyF'], pad: [3], implemented: true, press: 'tap' },
  { id: 'horn', label: 'Horn', context: 'vehicle', keys: ['KeyH'], pad: [11], implemented: true, press: 'hold' },
  { id: 'headlights', label: 'Headlights', context: 'vehicle', keys: ['KeyL'], pad: [14], implemented: true, press: 'tap' },
  { id: 'camera_view', label: 'Camera view (third / first person)', context: 'global', keys: ['KeyV'], pad: [13], implemented: true, press: 'tap' },
  { id: 'pause', label: 'Pause and settings', context: 'global', keys: ['Escape'], pad: [9], implemented: true, press: 'tap' },
  { id: 'quick_save', label: 'Quick save', context: 'global', keys: ['F5'], pad: [8], implemented: true, press: 'tap' },
  { id: 'quick_load', label: 'Quick load', context: 'global', keys: ['F9'], pad: [], implemented: true, press: 'tap' },
  { id: 'interact', label: 'Interact (context)', context: 'on_foot', keys: ['KeyE'], pad: [2], implemented: false, press: 'tap' },
  { id: 'aim', label: 'Aim', context: 'on_foot', keys: ['Mouse2'], pad: [6], implemented: false, press: 'hold' },
  { id: 'fire', label: 'Fire', context: 'on_foot', keys: ['Mouse0'], pad: [7], implemented: false, press: 'hold' },
  { id: 'reload', label: 'Reload', context: 'on_foot', keys: ['KeyR'], pad: [], implemented: false, press: 'tap' },
  { id: 'melee', label: 'Melee', context: 'on_foot', keys: ['KeyG'], pad: [1], implemented: false, press: 'tap' },
  { id: 'cover', label: 'Cover', context: 'on_foot', keys: ['KeyC'], pad: [5], implemented: false, press: 'tap' },
  { id: 'weapon_wheel', label: 'Weapon wheel (hold)', context: 'on_foot', keys: ['KeyQ'], pad: [4], implemented: false, press: 'hold' },
  { id: 'character_wheel', label: 'Character wheel (hold)', context: 'global', keys: ['Tab'], pad: [], implemented: false, press: 'hold' },
  { id: 'special_ability', label: 'Special ability', context: 'global', keys: ['KeyZ'], pad: [], implemented: false, press: 'hold' },
  { id: 'phone', label: 'Phone', context: 'global', keys: ['KeyP'], pad: [12], implemented: false, press: 'tap' },
  { id: 'map', label: 'Map', context: 'global', keys: ['KeyM'], pad: [], implemented: false, press: 'tap' },
  { id: 'radio_next', label: 'Radio station', context: 'vehicle', keys: ['KeyT'], pad: [15], implemented: false, press: 'tap' },
  { id: 'roof', label: 'Roof', context: 'vehicle', keys: ['KeyO'], pad: [], implemented: false, press: 'tap' },
  { id: 'landing_gear', label: 'Landing gear', context: 'vehicle', keys: ['KeyG'], pad: [], implemented: false, press: 'tap' },
  { id: 'vehicle_weapon', label: 'Vehicle weapon', context: 'vehicle', keys: ['Mouse0'], pad: [7], implemented: false, press: 'hold' },
];

export type Bindings = Record<string, string[]>;

export function defaultBindings(): Bindings {
  const out: Bindings = {};
  for (const a of ACTIONS) out[a.id] = [...a.keys];
  return out;
}

export interface BindingConflict {
  key: string;
  context: ActionContext;
  actions: string[];
}

/**
 * Two actions conflict when they share a key in the same context, or one is 'global' and the other is
 * context-specific (global keys are active everywhere). Two context-specific actions in different
 * contexts (e.g. Space = jump on foot, Space = handbrake in a vehicle) do not conflict.
 */
export function findConflicts(bindings: Bindings): BindingConflict[] {
  const byKey = new Map<string, Array<{ action: string; context: ActionContext }>>();
  for (const a of ACTIONS) {
    for (const k of bindings[a.id] ?? []) {
      const list = byKey.get(k) ?? [];
      list.push({ action: a.id, context: a.context });
      byKey.set(k, list);
    }
  }
  const conflicts: BindingConflict[] = [];
  for (const [key, entries] of byKey) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i]!;
        const b = entries[j]!;
        const overlap = a.context === b.context || a.context === 'global' || b.context === 'global';
        if (overlap) {
          const ctx: ActionContext = a.context === 'global' ? b.context : a.context;
          conflicts.push({ key, context: ctx, actions: [a.action, b.action] });
        }
      }
    }
  }
  return conflicts;
}

/**
 * Rebinds one action to a single key. The key is removed from any other action in an overlapping
 * context so the result never has an unintended double binding. Returns the displaced action ids.
 */
export function rebind(bindings: Bindings, actionId: string, key: string): { bindings: Bindings; displaced: string[] } {
  const target = ACTIONS.find((a) => a.id === actionId);
  if (!target) throw new Error(`Unknown action ${actionId}`);
  const next: Bindings = {};
  for (const k of Object.keys(bindings)) next[k] = [...bindings[k]!];
  const displaced: string[] = [];
  for (const a of ACTIONS) {
    if (a.id === actionId) continue;
    const overlap = a.context === target.context || a.context === 'global' || target.context === 'global';
    if (!overlap) continue;
    const list = next[a.id] ?? [];
    if (list.includes(key)) {
      next[a.id] = list.filter((k) => k !== key);
      displaced.push(a.id);
    }
  }
  next[actionId] = [key];
  return { bindings: next, displaced };
}

/** Keeps only known actions and string keys; falls back to defaults for missing actions. */
export function sanitizeBindings(raw: unknown): Bindings {
  const out = defaultBindings();
  if (!raw || typeof raw !== 'object') return out;
  for (const a of ACTIONS) {
    const v = (raw as Record<string, unknown>)[a.id];
    if (Array.isArray(v)) {
      const keys = v.filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length <= 32);
      out[a.id] = keys.slice(0, 3);
    }
  }
  return out;
}

/** Radial dead zone: keeps direction, rescales magnitude past the threshold to 0..1. */
export function radialDeadzone(x: number, y: number, dz: number): { x: number; y: number } {
  const m = Math.hypot(x, y);
  if (m <= dz) return { x: 0, y: 0 };
  const scaled = Math.min(1, (m - dz) / (1 - dz));
  return { x: (x / m) * scaled, y: (y / m) * scaled };
}
