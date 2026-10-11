import { describe, expect, it } from 'vitest';
import { NEUTRAL_INTENT, type Intent } from '../src/sim/intent';
import { makeCar, rightOf, stepCar } from '../src/sim/vehicle';
import { getHandlingProfile, KESTREL_HANDLING_ID } from '../src/sim/content';
import { mpsToKmh, kmhToMps } from '../src/sim/units';

const DT = 1 / 60;
const profile = getHandlingProfile(KESTREL_HANDLING_ID);
const drive = (c: ReturnType<typeof makeCar>, intent: Intent, seconds: number) => {
  for (let i = 0; i < seconds / DT; i++) stepCar(c, profile, intent, DT, []);
  return c;
};

// NOTE: these bands are checks against PROVISIONAL handling values. They verify internal consistency
// and designed behaviour. They do NOT verify fidelity to any reference vehicle (see docs/MECHANICS_NOTEBOOK.md).
describe('car handling (brief §16 subset; provisional numbers)', () => {
  it('T-VEH-001 0-100 km/h time and top speed fall inside the provisional bands', () => {
    const c = makeCar('t', 0, 0, 0);
    let t = 0;
    while (mpsToKmh(c.v) < 100 && t < 30) {
      stepCar(c, profile, { ...NEUTRAL_INTENT, throttle: 1 }, DT, []);
      t += DT;
    }
    expect(t).toBeGreaterThan(4.5);
    expect(t).toBeLessThan(8.0);
    drive(c, { ...NEUTRAL_INTENT, throttle: 1 }, 40);
    expect(c.v).toBeGreaterThan(50);
    expect(c.v).toBeLessThan(62);
  });

  it('T-VEH-002 full-service braking from 100 km/h stops inside the provisional distance band', () => {
    const c = makeCar('t', 0, 0, 0);
    c.v = kmhToMps(100);
    let dist = 0;
    for (let i = 0; i < 20 / DT && c.v > 0.05; i++) {
      const before = c.z;
      stepCar(c, profile, { ...NEUTRAL_INTENT, brake: 1 }, DT, []);
      dist += Math.abs(c.z - before);
    }
    expect(dist).toBeGreaterThan(35);
    expect(dist).toBeLessThan(50);
  });

  it('T-VEH-003 steady steering at low speed follows the kinematic turning radius, to the right when steering right', () => {
    const c = makeCar('t', 0, 0, 0);
    c.v = 8;
    const start = { x: c.x, z: c.z };
    const R = rightOf(c.yaw);
    drive(c, { ...NEUTRAL_INTENT, steer: 1, throttle: 0 }, 0.5);
    // Steering right should displace the car toward its right-hand vector.
    const dx = c.x - start.x;
    const dz = c.z - start.z;
    expect(dx * R.x + dz * R.z).toBeGreaterThan(0);

    // Kinematic prediction for steady yaw rate at 8 m/s with the speed-dependent steering falloff applied.
    // Measured steady state is about 14% below this prediction (tyre lag and the yaw-rate filter), so the
    // acceptance band is +/-20%. This is an internal-consistency check, not a reference measurement.
    const radiusM = profile.wheelbase_m / Math.tan((profile.max_steer_deg * Math.PI) / 180);
    const expectedRate = (8 / radiusM) / (1 + 8 / profile.steer_speed_falloff_mps);
    const c2 = makeCar('t2', 0, 0, 0);
    c2.v = 8;
    drive(c2, { ...NEUTRAL_INTENT, steer: 1 }, 1.5);
    expect(Math.abs(c2.r)).toBeGreaterThan(expectedRate * 0.8);
    expect(Math.abs(c2.r)).toBeLessThan(expectedRate * 1.2);
  });

  it('T-VEH-003 handbrake at speed breaks lateral grip and produces yaw rate', () => {
    const c = makeCar('t', 0, 0, 0);
    c.v = 25;
    drive(c, { ...NEUTRAL_INTENT, steer: 1, handbrake: true }, 0.6);
    expect(Math.abs(c.r) + Math.abs(c.u)).toBeGreaterThan(0.05);
  });

  it('T-VEH-003 a head-on wall hit removes inward speed and records impact damage', () => {
    const wall = [{ minX: 10, minY: 0, minZ: -20, maxX: 12, maxY: 5, maxZ: 20 }];
    const c = makeCar('t', 0, 0, Math.PI / 2); // facing +X
    c.v = 20;
    for (let i = 0; i < 3 / DT; i++) stepCar(c, profile, { ...NEUTRAL_INTENT, throttle: 1 }, DT, wall);
    expect(c.x).toBeLessThanOrEqual(10 + 0.01);
    expect(c.health).toBeLessThan(1000);
  });
});
