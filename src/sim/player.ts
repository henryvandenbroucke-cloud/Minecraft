import { pushCylinderOutOfBoxes, type Aabb } from './collision';
import type { Intent } from './intent';
import { GRAVITY_MPS2, clamp, wrapAngle } from './units';

/**
 * On-foot locomotion (Milestone A subset of brief §9).
 * Implemented: walk/jog/sprint blend, acceleration, turning rate, jump, gravity, landing impact damage,
 * stamina for sprinting, cylinder collision against static boxes with slide.
 * Not implemented: vaults, ladders, ledge climbing, ragdoll, swimming, stairs, step-up, roofs.
 */
export const ON_FOOT_TUNING = {
  radius: 0.35,
  height: 1.8,
  walkSpeed: 1.6, // m/s, PROVISIONAL
  jogSpeed: 3.6, // m/s, PROVISIONAL
  sprintSpeed: 6.2, // m/s, PROVISIONAL
  groundAccel: 14, // m/s^2
  airAccel: 4,
  turnRate: 9, // rad/s
  jumpSpeed: 4.4, // m/s, apex ~0.99 m
  fallDamageSpeed: 12, // m/s impact before damage starts
  fallDamagePerMps: 7, // health per m/s above threshold
  staminaMax: 100,
  staminaDrainPerSec: 12,
  staminaRegenPerSec: 18,
  sprintMinMagnitude: 0.5,
} as const;

export interface OnFootState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  onGround: boolean;
  stamina: number;
  health: number;
  /** Last landing impact (m/s), for presentation and tests. */
  lastImpact: number;
}

export function makeOnFoot(x: number, z: number, yaw = 0, health = 100): OnFootState {
  return { x, y: 0, z, vx: 0, vy: 0, vz: 0, yaw, onGround: true, stamina: ON_FOOT_TUNING.staminaMax, health, lastImpact: 0 };
}

export interface OnFootEvents {
  landed: boolean;
  jumped: boolean;
  impactSpeed: number;
}

/** Advances the on-foot state by dt seconds. Mutates and returns the same object for speed. */
export function stepOnFoot(s: OnFootState, intent: Intent, dt: number, boxes: readonly Aabb[], out?: OnFootEvents): OnFootState {
  const T = ON_FOOT_TUNING;
  const ev = out ?? { landed: false, jumped: false, impactSpeed: 0 };
  ev.landed = false;
  ev.jumped = false;
  ev.impactSpeed = 0;

  const mx = intent.moveX;
  const mz = intent.moveZ;
  const magRaw = Math.hypot(mx, mz);
  const mag = clamp(magRaw, 0, 1);

  // Sprint consumes stamina; without stamina it falls back to jog.
  const wantSprint = intent.sprint && mag >= T.sprintMinMagnitude && s.stamina > 0 && s.onGround;
  if (wantSprint) s.stamina = Math.max(0, s.stamina - T.staminaDrainPerSec * dt);
  else s.stamina = Math.min(T.staminaMax, s.stamina + T.staminaRegenPerSec * dt);

  let targetSpeed = 0;
  if (mag > 0.01) {
    targetSpeed = wantSprint ? T.sprintSpeed : T.walkSpeed + (T.jogSpeed - T.walkSpeed) * Math.min(1, mag);
    if (!wantSprint) targetSpeed = Math.min(targetSpeed, T.jogSpeed);
  }
  const dirX = magRaw > 1e-6 ? mx / magRaw : 0;
  const dirZ = magRaw > 1e-6 ? mz / magRaw : 0;
  const targetVx = dirX * targetSpeed;
  const targetVz = dirZ * targetSpeed;

  const accel = s.onGround ? T.groundAccel : T.airAccel;
  const maxStep = accel * dt;
  s.vx = approach(s.vx, targetVx, maxStep);
  s.vz = approach(s.vz, targetVz, maxStep);

  // Face the movement direction, limited by the turn rate.
  if (magRaw > 0.1) {
    const desired = Math.atan2(dirX, dirZ);
    const diff = wrapAngle(desired - s.yaw);
    const maxTurn = T.turnRate * dt;
    s.yaw = wrapAngle(s.yaw + clamp(diff, -maxTurn, maxTurn));
  }

  if (intent.jumpPressed && s.onGround) {
    s.vy = T.jumpSpeed;
    s.onGround = false;
    ev.jumped = true;
  }

  // Vertical motion with a flat ground plane at y = 0 (terrain heightfield is a gap).
  if (!s.onGround || s.y > 0 || s.vy !== 0) {
    s.vy -= GRAVITY_MPS2 * dt;
  }
  s.y += s.vy * dt;
  if (s.y <= 0) {
    s.y = 0;
    if (s.vy < 0) {
      const impact = -s.vy;
      ev.impactSpeed = impact;
      if (impact > 0.1) ev.landed = true;
      if (impact > T.fallDamageSpeed) {
        s.health = Math.max(0, s.health - (impact - T.fallDamageSpeed) * T.fallDamagePerMps);
      }
      s.lastImpact = impact;
    }
    s.vy = 0;
    s.onGround = true;
  } else {
    s.onGround = false;
  }

  // Horizontal move with box collision and velocity slide.
  const nx = s.x + s.vx * dt;
  const nz = s.z + s.vz * dt;
  const push = pushCylinderOutOfBoxes(nx, nz, s.y, T.height, T.radius, boxes);
  if (push.hit) {
    const into = s.vx * push.nx + s.vz * push.nz;
    if (into < 0) {
      s.vx -= into * push.nx;
      s.vz -= into * push.nz;
    }
  }
  s.x = push.x;
  s.z = push.z;
  return s;
}

function approach(current: number, target: number, maxDelta: number): number {
  const d = target - current;
  if (Math.abs(d) <= maxDelta) return target;
  return current + Math.sign(d) * maxDelta;
}
