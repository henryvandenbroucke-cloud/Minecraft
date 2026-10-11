import { describe, expect, it } from 'vitest';
import { ACTIONS, defaultBindings, findConflicts, radialDeadzone, rebind, sanitizeBindings } from '../src/sim/input-actions';

describe('input bindings (brief §6)', () => {
  it('T-INP-001 default bindings have no conflicts within a context', () => {
    expect(findConflicts(defaultBindings())).toEqual([]);
  });

  it('T-INP-001 Space is jump on foot and handbrake in a vehicle without conflicting', () => {
    const jump = ACTIONS.find((a) => a.id === 'jump')!;
    const hb = ACTIONS.find((a) => a.id === 'handbrake')!;
    expect(jump.keys).toContain('Space');
    expect(hb.keys).toContain('Space');
    expect(findConflicts(defaultBindings()).some((c) => c.key === 'Space')).toBe(false);
  });

  it('T-INP-001 rebinding removes the key from overlapping actions and reports what was displaced', () => {
    const b = defaultBindings();
    const r = rebind(b, 'sprint', 'KeyW'); // KeyW is move_forward (global), so it must be displaced
    expect(r.bindings.sprint).toEqual(['KeyW']);
    expect(r.bindings.move_forward).not.toContain('KeyW');
    expect(r.displaced).toContain('move_forward');
    expect(findConflicts(r.bindings).filter((c) => c.key === 'KeyW')).toEqual([]);
  });

  it('T-INP-001 detects a manually created conflict and sanitizes untrusted saved bindings', () => {
    const b = defaultBindings();
    b.horn = ['KeyF']; // global enter_exit already uses KeyF; horn is vehicle context, so this overlaps
    expect(findConflicts(b).some((c) => c.key === 'KeyF')).toBe(true);
    const clean = sanitizeBindings({ jump: ['KeyJ', 42, '', 'x'.repeat(40)], not_an_action: ['KeyZ'] });
    expect(clean.jump).toEqual(['KeyJ']);
    expect(clean).not.toHaveProperty('not_an_action');
    expect(clean.horn).toEqual(defaultBindings().horn);
  });

  it('T-INP-001 radial dead zone removes drift and rescales beyond the threshold', () => {
    expect(radialDeadzone(0.05, 0.05, 0.15)).toEqual({ x: 0, y: 0 });
    const full = radialDeadzone(1, 0, 0.15);
    expect(full.x).toBeCloseTo(1, 9);
    const half = radialDeadzone(0.575, 0, 0.15);
    expect(half.x).toBeCloseTo(0.5, 2);
  });
});

describe('T-INP-001 gamepad defaults', () => {
  it('no two actions in the same context share a pad button by default', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const a of ACTIONS) {
      for (const b of a.pad) {
        const k = `${a.context}:${b}`;
        const prev = seen.get(k);
        if (prev) clashes.push(`${k} ${prev} vs ${a.id}`);
        else seen.set(k, a.id);
      }
    }
    expect(clashes).toEqual([]);
  });
});
