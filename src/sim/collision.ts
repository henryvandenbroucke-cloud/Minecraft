import type { Vec3 } from './units';

/** Axis-aligned static box. Collision uses XZ for walls and Y for vertical overlap. */
export interface Aabb {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export function makeAabb(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Aabb {
  return {
    minX: Math.min(x0, x1),
    minY: Math.min(y0, y1),
    minZ: Math.min(z0, z1),
    maxX: Math.max(x0, x1),
    maxY: Math.max(y0, y1),
    maxZ: Math.max(z0, z1),
  };
}

export interface PushResult {
  x: number;
  z: number;
  hit: boolean;
  /** Unit normal of the last contact (XZ), pointing away from the obstacle. */
  nx: number;
  nz: number;
}

/**
 * Pushes a vertical cylinder (radius r, spanning y..y+h) out of the boxes in XZ.
 * Only boxes whose vertical extent overlaps the cylinder are considered.
 * Two passes resolve corners. Returns the corrected XZ and the last contact normal.
 */
export function pushCylinderOutOfBoxes(
  x: number,
  z: number,
  y: number,
  h: number,
  r: number,
  boxes: readonly Aabb[],
): PushResult {
  let hit = false;
  let nx = 0;
  let nz = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (const b of boxes) {
      if (y >= b.maxY - 1e-4 || y + h <= b.minY + 1e-4) continue;
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-12) {
        const d = Math.sqrt(d2);
        const push = r - d;
        nx = dx / d;
        nz = dz / d;
        x += nx * push;
        z += nz * push;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const penLeft = x - b.minX;
        const penRight = b.maxX - x;
        const penBack = z - b.minZ;
        const penFront = b.maxZ - z;
        const m = Math.min(penLeft, penRight, penBack, penFront);
        if (m === penLeft) {
          nx = -1;
          nz = 0;
          x = b.minX - r;
        } else if (m === penRight) {
          nx = 1;
          nz = 0;
          x = b.maxX + r;
        } else if (m === penBack) {
          nx = 0;
          nz = -1;
          z = b.minZ - r;
        } else {
          nx = 0;
          nz = 1;
          z = b.maxZ + r;
        }
      }
    }
  }
  return { x, z, hit, nx, nz };
}

/**
 * Slab-method ray test. dir must be normalised. Returns the distance to the first box
 * entry along the ray (>= 0), or null if nothing is hit within maxDist.
 */
export function raycastBoxes(origin: Vec3, dir: Vec3, maxDist: number, boxes: readonly Aabb[]): number | null {
  let best = maxDist;
  let found = false;
  for (const b of boxes) {
    let tmin = 0;
    let tmax = best;
    let ok = true;
    const axes: Array<[number, number, number, number, number]> = [
      [origin.x, dir.x, b.minX, b.maxX, 0],
      [origin.y, dir.y, b.minY, b.maxY, 1],
      [origin.z, dir.z, b.minZ, b.maxZ, 2],
    ];
    for (const [o, d, lo, hi] of axes) {
      if (Math.abs(d) < 1e-9) {
        if (o < lo || o > hi) {
          ok = false;
          break;
        }
        continue;
      }
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) {
        ok = false;
        break;
      }
    }
    if (ok && tmin <= best) {
      best = tmin;
      found = true;
    }
  }
  return found ? best : null;
}
