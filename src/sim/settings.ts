import { defaultBindings, sanitizeBindings, type Bindings } from './input-actions';
import { clamp } from './units';

/**
 * Player settings. Stored under their own key, separate from campaign saves (brief §6).
 * Only settings that the current build actually uses are present.
 */
export interface Settings {
  version: 1;
  mouseSensitivity: number; // 0.05..3
  invertY: boolean;
  padLookSensitivity: number; // 0.2..3
  stickDeadzone: number; // 0..0.5
  vibration: boolean;
  fov: number; // 50..90 degrees (vertical)
  hudScale: number; // 0.8..1.4
  textScale: number; // 0.8..1.6
  subtitles: boolean;
  cameraDistance: 'near' | 'mid' | 'far';
  firstPersonHeadBob: boolean;
  bindings: Bindings;
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  mouseSensitivity: 1,
  invertY: false,
  padLookSensitivity: 1.5,
  stickDeadzone: 0.15,
  vibration: true,
  fov: 65,
  hudScale: 1,
  textScale: 1,
  subtitles: true,
  cameraDistance: 'mid',
  firstPersonHeadBob: false,
  bindings: defaultBindings(),
};

/** Coerces arbitrary JSON into valid settings. Bad fields fall back to defaults instead of failing the load. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, lo: number, hi: number, d: number) =>
    typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d;
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  const dist = r.cameraDistance === 'near' || r.cameraDistance === 'far' ? r.cameraDistance : 'mid';
  return {
    version: 1,
    mouseSensitivity: num(r.mouseSensitivity, 0.05, 3, DEFAULT_SETTINGS.mouseSensitivity),
    invertY: bool(r.invertY, DEFAULT_SETTINGS.invertY),
    padLookSensitivity: num(r.padLookSensitivity, 0.2, 3, DEFAULT_SETTINGS.padLookSensitivity),
    stickDeadzone: num(r.stickDeadzone, 0, 0.5, DEFAULT_SETTINGS.stickDeadzone),
    vibration: bool(r.vibration, DEFAULT_SETTINGS.vibration),
    fov: num(r.fov, 50, 90, DEFAULT_SETTINGS.fov),
    hudScale: num(r.hudScale, 0.8, 1.4, DEFAULT_SETTINGS.hudScale),
    textScale: num(r.textScale, 0.8, 1.6, DEFAULT_SETTINGS.textScale),
    subtitles: bool(r.subtitles, DEFAULT_SETTINGS.subtitles),
    cameraDistance: dist,
    firstPersonHeadBob: bool(r.firstPersonHeadBob, DEFAULT_SETTINGS.firstPersonHeadBob),
    bindings: sanitizeBindings(r.bindings),
  };
}
