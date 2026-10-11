import { CELL_SIZE, inRegion } from './district';

export interface StreamingConfig {
  /** Cells within this Chebyshev radius of the focus are loaded. */
  loadRadiusCells: number;
  /** Cells beyond this radius are unloaded (hysteresis avoids load/unload thrash at the edge). */
  unloadRadiusCells: number;
  /** Extra look-ahead seconds of travel, so fast vehicles and aircraft get cells before they arrive. */
  lookaheadSeconds: number;
  /** Look-ahead distance is capped so a very fast vehicle does not request the whole map. */
  maxLookaheadCells: number;
}

export const DEFAULT_STREAMING: StreamingConfig = {
  loadRadiusCells: 2,
  unloadRadiusCells: 4,
  lookaheadSeconds: 6,
  maxLookaheadCells: 3,
};

export interface StreamFocus {
  x: number;
  z: number;
  vx: number;
  vz: number;
}

export interface StreamDelta {
  toLoad: Array<[number, number]>;
  toUnload: Array<[number, number]>;
}

export function cellIndexOf(v: number): number {
  return Math.floor(v / CELL_SIZE);
}

/**
 * Computes which region cells should be resident for a focus point, with look-ahead along velocity.
 * Preloading ahead of fast movers keeps collision valid before the player reaches an edge
 * (brief §8: never reveal empty collision).
 */
export class CellStreamer {
  readonly config: StreamingConfig;
  private readonly resident = new Set<string>();

  constructor(config: StreamingConfig = DEFAULT_STREAMING) {
    this.config = config;
  }

  get residentKeys(): string[] {
    return [...this.resident];
  }

  has(cx: number, cz: number): boolean {
    return this.resident.has(keyOf(cx, cz));
  }

  /** Marks cells as resident after the caller has completed their data load. */
  markLoaded(cx: number, cz: number): void {
    this.resident.add(keyOf(cx, cz));
  }

  markUnloaded(cx: number, cz: number): void {
    this.resident.delete(keyOf(cx, cz));
  }

  /** Computes the desired set and returns the cells to load (nearest first) and to unload. */
  plan(focus: StreamFocus): StreamDelta {
    const { loadRadiusCells, unloadRadiusCells, lookaheadSeconds, maxLookaheadCells } = this.config;
    const cx = cellIndexOf(focus.x);
    const cz = cellIndexOf(focus.z);
    const speed = Math.hypot(focus.vx, focus.vz);
    const aheadCells = Math.min(maxLookaheadCells, Math.ceil((speed * lookaheadSeconds) / CELL_SIZE));
    const aheadX = speed > 1e-6 ? Math.sign(focus.vx) * (Math.abs(focus.vx) / speed) : 0;
    const aheadZ = speed > 1e-6 ? Math.sign(focus.vz) * (Math.abs(focus.vz) / speed) : 0;
    const ax = cx + Math.round(aheadX * aheadCells);
    const az = cz + Math.round(aheadZ * aheadCells);

    const wanted = new Map<string, [number, number, number]>();
    const addRing = (ox: number, oz: number, r: number) => {
      for (let i = -r; i <= r; i++) {
        for (let j = -r; j <= r; j++) {
          const x = ox + i;
          const z = oz + j;
          if (!inRegion(x, z)) continue;
          const d = Math.max(Math.abs(x - cx), Math.abs(z - cz));
          wanted.set(keyOf(x, z), [x, z, d]);
        }
      }
    };
    addRing(cx, cz, loadRadiusCells);
    if (aheadCells > 0) addRing(ax, az, loadRadiusCells);

    const toLoad: Array<[number, number, number]> = [];
    for (const [key, [x, z, d]] of wanted) {
      if (!this.resident.has(key)) toLoad.push([x, z, d]);
    }
    toLoad.sort((a, b) => a[2] - b[2]);

    const toUnload: Array<[number, number]> = [];
    for (const key of this.resident) {
      const [x, z] = key.split(',').map(Number) as [number, number];
      const d = Math.max(Math.abs(x - cx), Math.abs(z - cz));
      if (!wanted.has(key) && d > unloadRadiusCells) toUnload.push([x, z]);
    }
    return { toLoad: toLoad.map(([x, z]) => [x, z]), toUnload };
  }
}

export function keyOf(cx: number, cz: number): string {
  return `${cx},${cz}`;
}
