/**
 * Units and constants (see docs/UNITS_AND_CLOCKS.md).
 * World units are metres. Engine/render space is Y-up, right-handed, so
 * (x, y, z) in the simulation maps 1:1 to three.js world space.
 * Yaw 0 faces +Z; positive yaw turns toward +X.
 */
export const METERS_PER_UNIT = 1;
export const GRAVITY_MPS2 = 9.81;
export const SIM_HZ = 60;
export const FIXED_DT = 1 / SIM_HZ;
/** Real frame deltas are clamped so a stalled tab cannot explode the physics step count. */
export const MAX_FRAME_DT = 0.25;

export const kmhToMps = (kmh: number): number => kmh / 3.6;
export const mpsToKmh = (mps: number): number => mps * 3.6;

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const wrapAngle = (a: number): number => {
  let r = (a + Math.PI) % (Math.PI * 2);
  if (r < 0) r += Math.PI * 2;
  return r - Math.PI;
};

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
