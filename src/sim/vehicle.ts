import { pushCylinderOutOfBoxes, type Aabb } from './collision';
import type { Intent } from './intent';
import { clamp } from './units';

/**
 * Arcade car model (brief §16, Milestone A subset).
 * Kinematic-bicycle steering with a friction-circle lateral grip model, single-speed engine curve,
 * quadratic drag, rolling resistance, service brake, handbrake that reduces lateral grip, and
 * box collision with impact damage. Coordinates: yaw 0 faces +Z; forward f = (sin yaw, 0, cos yaw);
 * right R = (-cos yaw, 0, sin yaw). Positive steer turns right (yaw decreases).
 * All numbers come from a handling profile. They are PROVISIONAL, not reference measurements.
 */
export interface HandlingProfile {
  id: string;
  mass_kg: number;
  wheelbase_m: number;
  max_steer_deg: number;
  steer_speed_falloff_mps: number;
  engine_peak_force_n: number;
  engine_max_speed_mps: number;
  drag_coefficient_cdA: number;
  rolling_resistance_n: number;
  brake_decel_mps2: number;
  handbrake_decel_mps2: number;
  handbrake_grip_factor: number;
  lateral_grip_mu: number;
  wet_grip_factor: number;
  length_m: number;
  width_m: number;
}

export interface CarState {
  id: string;
  x: number;
  z: number;
  yaw: number;
  /** Forward speed (m/s). Negative is reverse. */
  v: number;
  /** Lateral speed toward R (m/s). */
  u: number;
  /** Yaw rate (rad/s). */
  r: number;
  health: number;
  headlights: boolean;
  hornOn: boolean;
  /** Last impact speed along the contact normal (m/s). */
  lastImpact: number;
}

export const AIR_DENSITY = 1.225;
export const CAR_BODY_HEIGHT = 1.4;
const IMPACT_DAMAGE_THRESHOLD = 6; // m/s
const IMPACT_DAMAGE_PER_MPS = 35;

export function makeCar(id: string, x: number, z: number, yaw: number): CarState {
  return { id, x, z, yaw, v: 0, u: 0, r: 0, health: 1000, headlights: false, hornOn: false, lastImpact: 0 };
}

export function forwardOf(yaw: number): { x: number; z: number } {
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

export function rightOf(yaw: number): { x: number; z: number } {
  return { x: -Math.cos(yaw), z: Math.sin(yaw) };
}

export function stepCar(c: CarState, p: HandlingProfile, intent: Intent, dt: number, boxes: readonly Aabb[], wetFactor = 1): CarState {
  const maxSteer = (p.max_steer_deg * Math.PI) / 180;
  const absV = Math.abs(c.v);

  // Steering: speed-dependent falloff, then a yaw-rate target from the kinematic bicycle.
  const steerAngle = clamp(intent.steer, -1, 1) * maxSteer / (1 + absV / p.steer_speed_falloff_mps);
  const rTarget = (-c.v * Math.tan(steerAngle)) / p.wheelbase_m;
  c.r += (clamp(rTarget, -2.2, 2.2) - c.r) * Math.min(1, 8 * dt);

  // Longitudinal force balance.
  const throttle = clamp(intent.throttle, 0, 1);
  const brake = clamp(intent.brake, 0, 1);
  let force = 0;
  if (throttle > 0) {
    const frac = clamp(1 - c.v / p.engine_max_speed_mps, 0, 1);
    force += throttle * p.engine_peak_force_n * frac;
  }
  // Reverse: braking while (nearly) stopped engages reverse gear with a weaker force.
  if (brake > 0 && c.v <= 0.5 && throttle === 0) {
    const rev = clamp(1 - -c.v / 12, 0, 1);
    force -= brake * p.engine_peak_force_n * 0.4 * rev;
  }
  force -= Math.sign(c.v) * (0.5 * AIR_DENSITY * p.drag_coefficient_cdA * c.v * c.v + p.rolling_resistance_n) * (absV > 1e-3 ? 1 : 0);
  let accel = force / p.mass_kg;
  if (brake > 0 && c.v > 0.5) {
    accel -= brake * p.brake_decel_mps2;
  }
  if (intent.handbrake && absV > 0.5) {
    accel -= Math.sign(c.v) * p.handbrake_decel_mps2 * 0.5;
  }
  c.v += (accel - c.u * c.r) * dt;
  // Stop when braking through zero from forward motion (avoids creeping into reverse by drag alone).
  if (brake > 0 && throttle === 0 && Math.abs(c.v) < 0.2 && c.v > -0.2) c.v = 0;

  // Lateral: centripetal coupling, then friction-circle kill up to mu*g (reduced when handbraking).
  c.u += c.v * c.r * dt;
  const mu = p.lateral_grip_mu * wetFactor * (intent.handbrake ? p.handbrake_grip_factor : 1);
  const lim = mu * 9.81 * dt;
  c.u -= clamp(c.u, -lim, lim);

  // Heading and position from body velocity.
  c.yaw += c.r * dt;
  const f = forwardOf(c.yaw);
  const R = rightOf(c.yaw);
  const hx = c.v * f.x + c.u * R.x;
  const hz = c.v * f.z + c.u * R.z;
  const nx = c.x + hx * dt;
  const nz = c.z + hz * dt;

  // Collision with two circles (front and rear half of the body).
  const half = p.length_m / 2 - p.width_m / 2;
  const rad = p.width_m / 2;
  let px = nx;
  let pz = nz;
  let worst = 0;
  let vnWorst = 0;
  for (const s of [1, -1]) {
    const cx = px + f.x * half * s;
    const cz = pz + f.z * half * s;
    const res = pushCylinderOutOfBoxes(cx, cz, 0, CAR_BODY_HEIGHT, rad, boxes);
    if (res.hit) {
      const dx = res.x - cx;
      const dz = res.z - cz;
      px += dx;
      pz += dz;
      const vn = -(hx * res.nx + hz * res.nz);
      if (vn > worst) {
        worst = vn;
      }
      // Remove the inward component of velocity.
      const into = hx * res.nx + hz * res.nz;
      if (into < 0) {
        c.v -= (into * res.nx * f.x + into * res.nz * f.z);
        c.u -= into * (res.nx * R.x + res.nz * R.z);
      }
      vnWorst = Math.max(vnWorst, vn);
    }
  }
  c.x = px;
  c.z = pz;
  c.lastImpact = worst;
  if (vnWorst > IMPACT_DAMAGE_THRESHOLD) {
    c.health = Math.max(0, c.health - (vnWorst - IMPACT_DAMAGE_THRESHOLD) * IMPACT_DAMAGE_PER_MPS);
  }
  c.hornOn = intent.hornHeld;
  return c;
}
