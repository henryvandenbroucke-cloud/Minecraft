import { describe, expect, it } from 'vitest';
import { SimClock } from '../src/sim/clock';
import { FIXED_DT } from '../src/sim/units';

describe('clock (brief §4)', () => {
  it('T-CLK-001 converts frame time to fixed steps independent of frame rate', () => {
    const a = new SimClock();
    const b = new SimClock();
    let stepsA = 0;
    for (let i = 0; i < 300; i++) stepsA += a.advanceReal(1 / 300); // 300 Hz rendering
    let stepsB = 0;
    for (let i = 0; i < 30; i++) stepsB += b.advanceReal(1 / 30); // 30 Hz rendering
    // Both represent one real second: 60 fixed steps each (accumulator carries the remainder).
    expect(Math.abs(stepsA - 60)).toBeLessThanOrEqual(1);
    expect(Math.abs(stepsB - 60)).toBeLessThanOrEqual(1);
  });

  it('T-CLK-001 clamps huge frame stalls so the step count cannot explode', () => {
    const c = new SimClock();
    const steps = c.advanceReal(30); // a 30 s stall
    expect(steps).toBeLessThanOrEqual(Math.ceil(0.25 / FIXED_DT));
  });

  it('T-CLK-001 pause stops simulation steps but keeps real time moving', () => {
    const c = new SimClock();
    c.paused = true;
    expect(c.advanceReal(1)).toBe(0);
    expect(c.realSeconds).toBeCloseTo(0.25); // clamped to MAX_FRAME_DT
  });

  it('T-CLK-001 slow motion scales only the ability timeline, never the game clock or sim time', () => {
    const normal = new SimClock();
    const slow = new SimClock();
    slow.setLocalScale(0.2);
    for (let i = 0; i < 600; i++) {
      normal.tick();
      slow.tick();
    }
    expect(slow.gameMinutes).toBeCloseTo(normal.gameMinutes, 9);
    expect(slow.simSeconds).toBeCloseTo(normal.simSeconds, 9);
    expect(slow.abilityTime).toBeCloseTo(normal.abilityTime * 0.2, 6);
  });

  it('T-CLK-001 default day length is a tunable, not a fixed claim', () => {
    const c = new SimClock({ dayLengthRealSeconds: 2880, startHour: 0 });
    expect(c.gameMinutesPerSimSecond).toBeCloseTo(0.5, 9);
    const fast = new SimClock({ dayLengthRealSeconds: 1440, startHour: 0 });
    expect(fast.gameMinutesPerSimSecond).toBeCloseTo(1, 9);
  });
});
