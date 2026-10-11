import type { Aabb } from '../collision';

/**
 * Colliders grouped by streamed cell. A query visits only the cells whose rectangles overlap the
 * query, so per-step cost does not grow with the whole loaded region (brief §3: no global searches per frame).
 */
export class ColliderIndex {
  private readonly cellSize: number;
  private readonly boxesByKey = new Map<string, Aabb[]>();
  private readonly coordsByKey = new Map<string, [number, number]>();

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  setCell(key: string, cx: number, cz: number, boxes: Aabb[]): void {
    this.boxesByKey.set(key, boxes);
    this.coordsByKey.set(key, [cx, cz]);
  }

  removeCell(key: string): void {
    this.boxesByKey.delete(key);
    this.coordsByKey.delete(key);
  }

  has(key: string): boolean {
    return this.boxesByKey.has(key);
  }

  get loadedCount(): number {
    return this.boxesByKey.size;
  }

  /** Appends boxes from loaded cells overlapping [x0,x1]x[z0,z1] to `out` and returns it. */
  query(x0: number, z0: number, x1: number, z1: number, out: Aabb[] = []): Aabb[] {
    for (const [key, [cx, cz]] of this.coordsByKey) {
      const cx0 = cx * this.cellSize;
      const cz0 = cz * this.cellSize;
      if (cx0 > x1 || cx0 + this.cellSize < x0 || cz0 > z1 || cz0 + this.cellSize < z0) continue;
      const list = this.boxesByKey.get(key);
      if (list) for (const b of list) out.push(b);
    }
    return out;
  }
}
