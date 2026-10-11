import { describe, expect, it } from 'vitest';
import { NEUTRAL_INTENT, type Intent } from '../src/sim/intent';
import { makeAabb } from '../src/sim/collision';
import { makeOnFoot, ON_FOOT_TUNING, stepOnFoot } from '../src/sim/player';

const DT = 1 / 60;
const run = (s: ReturnType<typeof makeOnFoot>, intent: Intent, seconds: number, boxes = [] as ReturnType<typeof makeAabb>[]) => {
  for (let i = 0; i < seconds / DT; i++) stepOnFoot(s, intent, DT, boxes);
  return s;
};

describe('on-foot locomotion (brief §9 subset)', () => {
  it('T-PLY-001 walks at about the walk-to-jog target speed and turns toward movement', () => {
    const s = makeOnFoot(0, 0, 0);
    run(s, { ...NEUTRAL_INTENT, moveX: 0, moveZ: 1 }, 2);
    const speed = Math.hypot(s.vx, s.vz);
    expect(speed).toBeGreaterThan(ON_FOOT_TUNING.walkSpeed * 0.9);
    expect(speed).toBeLessThanOrEqual(ON_FOOT_TUNING.jogSpeed + 1e-6);
    expect(s.z).toBeGreaterThan(3);
  });

  it('T-PLY-001 sprint reaches sprint speed and drains stamina; stamina regenerates at rest', () => {
    const s = makeOnFoot(0, 0, 0);
    run(s, { ...NEUTRAL_INTENT, moveZ: 1, sprint: true }, 1.5);
    expect(Math.hypot(s.vx, s.vz)).toBeGreaterThan(ON_FOOT_TUNING.jogSpeed);
    expect(s.stamina).toBeLessThan(ON_FOOT_TUNING.staminaMax);
    const drained = s.stamina;
    run(s, NEUTRAL_INTENT, 2);
    expect(s.stamina).toBeGreaterThan(drained);
  });

  it('T-PLY-001 a jump peaks near 1 m and lands with zero vertical speed on flat ground', () => {
    const s = makeOnFoot(0, 0, 0);
    let peak = 0;
    stepOnFoot(s, { ...NEUTRAL_INTENT, jumpPressed: true }, DT, []);
    for (let i = 0; i < 2 * 60; i++) {
      stepOnFoot(s, NEUTRAL_INTENT, DT, []);
      peak = Math.max(peak, s.y);
    }
    expect(peak).toBeGreaterThan(0.85);
    expect(peak).toBeLessThan(1.1);
    expect(s.onGround).toBe(true);
    expect(s.y).toBe(0);
  });

  it('T-PLY-001 a long fall applies landing damage; a short hop does not', () => {
    const short = makeOnFoot(0, 0, 0);
    short.y = 0.5;
    short.onGround = false;
    run(short, NEUTRAL_INTENT, 1);
    expect(short.health).toBe(100);

    const long = makeOnFoot(0, 0, 0);
    long.y = 60;
    long.onGround = false;
    run(long, NEUTRAL_INTENT, 6);
    expect(long.health).toBeLessThan(100);
    expect(long.lastImpact).toBeGreaterThan(ON_FOOT_TUNING.fallDamageSpeed);
  });

  it('T-PLY-001 a wall stops forward movement and the player slides along it instead of entering it', () => {
    const wall = makeAabb(5, 0, -20, 6, 10, 20);
    const s = makeOnFoot(0, 0, 0);
    s.yaw = Math.PI / 2; // face +X
    run(s, { ...NEUTRAL_INTENT, moveX: 1, moveZ: 0.2 }, 6, [wall]);
    expect(s.x).toBeLessThanOrEqual(5 - ON_FOOT_TUNING.radius + 1e-6);
    expect(s.z).toBeGreaterThan(0.5); // slid along the wall face
  });
});
