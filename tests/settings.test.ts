import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../src/sim/settings';

describe('settings (brief §6)', () => {
  it('T-SET-001 clamps out-of-range numbers and falls back for wrong types', () => {
    const s = sanitizeSettings({ mouseSensitivity: 99, fov: 'wide', hudScale: -4, invertY: 'yes', cameraDistance: 'huge' });
    expect(s.mouseSensitivity).toBe(3);
    expect(s.fov).toBe(DEFAULT_SETTINGS.fov);
    expect(s.hudScale).toBe(0.8);
    expect(s.invertY).toBe(false);
    expect(s.cameraDistance).toBe('mid');
  });

  it('T-SET-001 empty input yields the defaults and a usable binding table', () => {
    const s = sanitizeSettings(undefined);
    expect(s).toEqual(DEFAULT_SETTINGS);
    expect(s.bindings.move_forward.length).toBeGreaterThan(0);
  });
});
