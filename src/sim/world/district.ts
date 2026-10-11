/**
 * Deterministic procedural district. Original geometry only (no reference data).
 * Layout: a grid of blocks separated by roads. A cell is 2x2 blocks, so cells never split a road.
 * Geometry is a pure function of (seed, cell), which makes streaming reproducible and testable.
 */
export const BLOCK_SIZE = 80;
export const ROAD_WIDTH = 16;
export const PITCH = BLOCK_SIZE + ROAD_WIDTH; // 96
export const BLOCKS_PER_CELL = 2;
export const CELL_SIZE = PITCH * BLOCKS_PER_CELL; // 192
/** Inclusive cell index bounds of the playable region (12 x 12 cells, about 2.3 km square). */
export const REGION_CELL_MIN = -6;
export const REGION_CELL_MAX = 5;
export const REGION_BOUNDS = {
  minX: REGION_CELL_MIN * CELL_SIZE,
  maxX: (REGION_CELL_MAX + 1) * CELL_SIZE,
  minZ: REGION_CELL_MIN * CELL_SIZE,
  maxZ: (REGION_CELL_MAX + 1) * CELL_SIZE,
};

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface BuildingDef extends Rect {
  height: number;
  color: number;
}

export interface CellData {
  cx: number;
  cz: number;
  buildings: BuildingDef[];
  /** Road surfaces (rendering). Lane graphs are not generated yet (gap). */
  roads: Rect[];
  /** Block paving (rendering). */
  paving: Rect[];
}

/** Integer hash (xmur3-style). Returns a uint32. */
export function hash(seed: number, a: number, b: number, salt = 0): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (const v of [a | 0, b | 0, salt | 0]) {
    h = Math.imul(h ^ v, 0x85ebca6b) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic float in [0,1). */
export function rand01(seed: number, a: number, b: number, salt = 0): number {
  return hash(seed, a, b, salt) / 4294967296;
}

const PALETTE = [0x8c8478, 0x6e7b86, 0xa39a8a, 0x5d6b6f, 0xb7a58a, 0x7a6f66, 0x9aa3a8, 0x8f5f4f];

export function cellRect(cx: number, cz: number): Rect {
  return { x0: cx * CELL_SIZE, z0: cz * CELL_SIZE, x1: (cx + 1) * CELL_SIZE, z1: (cz + 1) * CELL_SIZE };
}

export function inRegion(cx: number, cz: number): boolean {
  return cx >= REGION_CELL_MIN && cx <= REGION_CELL_MAX && cz >= REGION_CELL_MIN && cz <= REGION_CELL_MAX;
}

/** Downtown core sits at the world origin; building height falls off with distance. */
function baseHeight(x: number, z: number): number {
  const d = Math.hypot(x, z);
  return 6 + 58 * Math.exp(-d / 650);
}

export function generateCell(seed: number, cx: number, cz: number): CellData {
  const buildings: BuildingDef[] = [];
  const roads: Rect[] = [];
  const paving: Rect[] = [];
  if (!inRegion(cx, cz)) return { cx, cz, buildings, roads, paving };

  const cell = cellRect(cx, cz);
  // Roads: index k lies between block k and block k+1. Each cell owns roads k = 2cx and 2cx+1 along each axis.
  for (let k = cx * BLOCKS_PER_CELL; k < (cx + 1) * BLOCKS_PER_CELL; k++) {
    // Road running along Z, between block columns k and k+1.
    const xs = k * PITCH + BLOCK_SIZE;
    roads.push({ x0: xs, z0: cell.z0, x1: xs + ROAD_WIDTH, z1: cell.z1 });
  }
  for (let k = cz * BLOCKS_PER_CELL; k < (cz + 1) * BLOCKS_PER_CELL; k++) {
    // Road running along X, between block rows k and k+1.
    const zs = k * PITCH + BLOCK_SIZE;
    roads.push({ x0: cell.x0, z0: zs, x1: cell.x1, z1: zs + ROAD_WIDTH });
  }

  for (let bi = cx * BLOCKS_PER_CELL; bi < (cx + 1) * BLOCKS_PER_CELL; bi++) {
    for (let bj = cz * BLOCKS_PER_CELL; bj < (cz + 1) * BLOCKS_PER_CELL; bj++) {
      const bx0 = bi * PITCH;
      const bz0 = bj * PITCH;
      const block: Rect = { x0: bx0, z0: bz0, x1: bx0 + BLOCK_SIZE, z1: bz0 + BLOCK_SIZE };
      paving.push(block);
      const inset = 6;
      const lot: Rect = { x0: bx0 + inset, z0: bz0 + inset, x1: bx0 + BLOCK_SIZE - inset, z1: bz0 + BLOCK_SIZE - inset };
      const cxm = (lot.x0 + lot.x1) / 2;
      const czm = (lot.z0 + lot.z1) / 2;
      const split = rand01(seed, bi, bj, 1) < 0.35;
      const palette = PALETTE[hash(seed, bi, bj, 2) % PALETTE.length];
      const shrink = 0.7 + 0.3 * rand01(seed, bi, bj, 3);
      if (!split) {
        const h = Math.max(6, baseHeight(cxm, czm) * (0.6 + 0.6 * rand01(seed, bi, bj, 4)) * shrink);
        buildings.push({ ...lot, height: round1(h), color: palette });
      } else {
        // Two towers side by side with a gap, so parallel streets stay readable.
        const mid = (lot.x0 + lot.x1) / 2;
        const gap = 3;
        for (const [a, b, salt] of [
          [lot.x0, mid - gap / 2, 5],
          [mid + gap / 2, lot.x1, 6],
        ] as const) {
          const h = Math.max(6, baseHeight(cxm, czm) * (0.4 + 1.0 * rand01(seed, bi, bj, salt)));
          buildings.push({ x0: a, z0: lot.z0, x1: b, z1: lot.z1, height: round1(h), color: palette });
        }
      }
    }
  }
  return { cx, cz, buildings, roads, paving };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Player and vehicle spawn: the north-west intersection of the first road pair (world origin area). */
export const SPAWN_POINT = { x: BLOCK_SIZE + ROAD_WIDTH / 2, z: BLOCK_SIZE + ROAD_WIDTH / 2 };
/** Kestrel GT parked on the east curb of the north-south road, away from the intersection. */
export const PARKED_CAR_SPAWN = { x: BLOCK_SIZE + ROAD_WIDTH * 0.8, z: BLOCK_SIZE + 60, yaw: 0 };
