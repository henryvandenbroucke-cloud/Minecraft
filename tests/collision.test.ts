import { describe, expect, it } from 'vitest';
import { makeAabb, pushCylinderOutOfBoxes, raycastBoxes } from '../src/sim/collision';
import { ColliderIndex } from '../src/sim/world/collider-index';

describe('collision primitives', () => {
  const wall = makeAabb(2, 0, -10, 3, 10, 10); // thin wall at x in [2,3]

  it('T-COL-001 pushes a cylinder out of a box face along the contact normal', () => {
    const r = pushCylinderOutOfBoxes(1.8, 0, 0, 1.8, 0.35, [wall]);
    expect(r.hit).toBe(true);
    expect(r.x).toBeCloseTo(2 - 0.35, 6);
    expect(r.nx).toBeCloseTo(-1, 6);
  });

  it('T-COL-001 ignores boxes that do not overlap vertically (overhead and below)', () => {
    const high = makeAabb(2, 5, -10, 3, 10, 10);
    const r = pushCylinderOutOfBoxes(1.8, 0, 0, 1.8, 0.35, [high]);
    expect(r.hit).toBe(false);
    expect(r.x).toBe(1.8);
  });

  it('T-COL-001 resolves a centre inside a box by the smallest penetration axis', () => {
    const r = pushCylinderOutOfBoxes(2.1, 0, 0, 1.8, 0.35, [wall]);
    expect(r.hit).toBe(true);
    expect(r.x).toBeLessThan(2);
  });

  it('T-COL-001 raycast returns the entry distance or null', () => {
    const d = raycastBoxes({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 100, [wall]);
    expect(d).toBeCloseTo(2, 6);
    expect(raycastBoxes({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 1, [wall])).toBeNull();
    expect(raycastBoxes({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }, 100, [wall])).toBeNull();
  });

  it('T-COL-001 collider index queries only overlapping cells', () => {
    const idx = new ColliderIndex(192);
    idx.setCell('0,0', 0, 0, [wall]);
    idx.setCell('5,5', 5, 5, [makeAabb(0, 0, 0, 1, 1, 1)]);
    expect(idx.query(0, 0, 10, 10)).toHaveLength(1);
    expect(idx.query(5000, 5000, 5010, 5010)).toHaveLength(0);
    idx.removeCell('0,0');
    expect(idx.has('0,0')).toBe(false);
  });
});
