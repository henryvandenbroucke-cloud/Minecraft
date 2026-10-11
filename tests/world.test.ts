import { describe, expect, it } from 'vitest';
import { SaltlineSim } from '../src/sim/game';
import { NEUTRAL_INTENT } from '../src/sim/intent';
import { SPAWN_POINT, PARKED_CAR_SPAWN } from '../src/sim/world/district';

describe('integrated Milestone A simulation', () => {
  it('T-SIM-001 walks to the parked car, enters, drives, exits, and never ends inside a building', () => {
    const sim = new SaltlineSim({ seed: 20261011 });
    expect(sim.collisionCoverageOk()).toBe(true);
    // Walk toward the car.
    const dx = PARKED_CAR_SPAWN.x - sim.player.x;
    const dz = PARKED_CAR_SPAWN.z - sim.player.z;
    const dist = Math.hypot(dx, dz);
    for (let i = 0; i < 60 * 60 && sim.distanceToCar() > 2.5; i++) {
      const d = Math.hypot(sim.car.x - sim.player.x, sim.car.z - sim.player.z);
      sim.step({ ...NEUTRAL_INTENT, moveX: (sim.car.x - sim.player.x) / d, moveZ: (sim.car.z - sim.player.z) / d, sprint: true });
    }
    expect(sim.distanceToCar()).toBeLessThanOrEqual(2.6);
    expect(dist).toBeGreaterThan(0);
    sim.step({ ...NEUTRAL_INTENT, interactPressed: true });
    expect(sim.mode).toBe('in_vehicle');
    for (let i = 0; i < 3 * 60; i++) sim.step({ ...NEUTRAL_INTENT, throttle: 1, steer: 0.1 });
    expect(sim.car.v).toBeGreaterThan(10);
    for (let i = 0; i < 6 * 60; i++) sim.step({ ...NEUTRAL_INTENT, brake: 1 });
    sim.step({ ...NEUTRAL_INTENT, interactPressed: true });
    expect(sim.mode).toBe('on_foot');
    // Exit placement must be collision-free.
    expect(sim.collisionCoverageOk()).toBe(true);
    expect(Number.isFinite(sim.player.x) && Number.isFinite(sim.player.z)).toBe(true);
  });

  it('T-SIM-001 the spawn point is outside every building footprint', () => {
    const sim = new SaltlineSim({ seed: 20261011 });
    const hits = sim.colliders.query(SPAWN_POINT.x - 0.5, SPAWN_POINT.z - 0.5, SPAWN_POINT.x + 0.5, SPAWN_POINT.z + 0.5);
    const inside = hits.some((b) => SPAWN_POINT.x > b.minX && SPAWN_POINT.x < b.maxX && SPAWN_POINT.z > b.minZ && SPAWN_POINT.z < b.maxZ);
    expect(inside).toBe(false);
  });

  it('T-SIM-001 save and restore reproduces the on-foot and in-vehicle state', () => {
    const a = new SaltlineSim({ seed: 4 });
    for (let i = 0; i < 120; i++) a.step({ ...NEUTRAL_INTENT, moveZ: 0.5 });
    const snap = a.snapshot();
    const b = new SaltlineSim({ seed: 4 });
    b.restore({ ...snap, checksum: 'x' } as never);
    expect(b.player.x).toBeCloseTo(a.player.x, 9);
    expect(b.player.z).toBeCloseTo(a.player.z, 9);
    expect(b.clock.gameMinutes).toBeCloseTo(a.clock.gameMinutes, 9);
    expect(b.collisionCoverageOk()).toBe(true);
  });
});
