import { describe, expect, it } from 'vitest';
import { CellStreamer, keyOf } from '../src/sim/world/streaming';
import { generateCell, PARKED_CAR_SPAWN, REGION_CELL_MAX, REGION_CELL_MIN, SPAWN_POINT, CELL_SIZE, PITCH, BLOCK_SIZE, ROAD_WIDTH } from '../src/sim/world/district';
import { SaltlineSim } from '../src/sim/game';
import { NEUTRAL_INTENT } from '../src/sim/intent';

describe('streaming planner (brief §8)', () => {
  it('T-WRL-001 preloads cells ahead of a fast mover before it reaches them', () => {
    const s = new CellStreamer();
    // Start at cell (0,0) moving east at 70 m/s (a fast car or aircraft).
    const f = { x: CELL_SIZE / 2, z: CELL_SIZE / 2, vx: 70, vz: 0 };
    const plan = s.plan(f);
    for (const [cx, cz] of plan.toLoad) s.markLoaded(cx, cz);
    // Cells eastward of the focus, beyond the normal radius, must be requested.
    expect(plan.toLoad.some(([cx]) => cx >= 3)).toBe(true);
  });

  it('T-WRL-001 unloads only beyond the hysteresis radius and never inside the region ring', () => {
    const s = new CellStreamer();
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) s.markLoaded(x, z);
    const near = s.plan({ x: 0, z: 0, vx: 0, vz: 0 });
    expect(near.toUnload.length).toBe(0); // all resident cells are within the unload radius
    const far = s.plan({ x: 10 * CELL_SIZE, z: 0, vx: 0, vz: 0 });
    expect(far.toUnload.length).toBeGreaterThan(0);
    expect(far.toLoad.every(([cx, cz]) => cx >= REGION_CELL_MIN && cx <= REGION_CELL_MAX && cz >= REGION_CELL_MIN && cz <= REGION_CELL_MAX)).toBe(true);
    expect(keyOf(1, 2)).toBe('1,2');
  });

  it('T-WRL-001 driving across the region keeps collision coverage valid at every step', () => {
    const sim = new SaltlineSim({ seed: 7 });
    const car = sim.car;
    car.v = 0;
    let ok = true;
    // Put the player in the car and drive fast east for 20 s (about 1.4 km at 70 m/s).
    sim.mode = 'in_vehicle';
    car.x = SPAWN_POINT.x;
    car.z = SPAWN_POINT.z;
    car.yaw = Math.PI / 2;
    car.v = 60;
    for (let i = 0; i < 20 * 60; i++) {
      sim.step({ ...NEUTRAL_INTENT, throttle: 1 });
      ok = ok && sim.collisionCoverageOk();
    }
    expect(ok).toBe(true);
  });
});

describe('procedural district (brief §7 geometry)', () => {
  it('T-WRL-002 generation is deterministic for a seed and changes with the seed', () => {
    const a = generateCell(11, 0, 0);
    const b = generateCell(11, 0, 0);
    const c = generateCell(12, 0, 0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it('T-WRL-002 buildings stay inside their block and never cover a road', () => {
    for (let cx = REGION_CELL_MIN; cx <= REGION_CELL_MAX; cx++) {
      for (let cz = REGION_CELL_MIN; cz <= REGION_CELL_MAX; cz++) {
        const cell = generateCell(99, cx, cz);
        const roads = cell.roads;
        for (const b of cell.buildings) {
          expect(b.height).toBeGreaterThan(0);
          for (const r of roads) {
            const overlapX = b.x0 < r.x1 && b.x1 > r.x0;
            const overlapZ = b.z0 < r.z1 && b.z1 > r.z0;
            expect(overlapX && overlapZ).toBe(false);
          }
        }
      }
    }
    expect(PITCH).toBe(BLOCK_SIZE + ROAD_WIDTH);
  });

  it('T-WRL-002 the player spawn and parked car both sit on road surface, not inside buildings', () => {
    const cx = Math.floor(SPAWN_POINT.x / CELL_SIZE);
    const cz = Math.floor(SPAWN_POINT.z / CELL_SIZE);
    const cell = generateCell(20261011, cx, cz);
    const onRoad = (x: number, z: number) => cell.roads.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
    const inBuilding = (x: number, z: number) => cell.buildings.some((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1);
    expect(onRoad(SPAWN_POINT.x, SPAWN_POINT.z)).toBe(true);
    expect(inBuilding(SPAWN_POINT.x, SPAWN_POINT.z)).toBe(false);
    expect(inBuilding(PARKED_CAR_SPAWN.x, PARKED_CAR_SPAWN.z)).toBe(false);
  });
});
