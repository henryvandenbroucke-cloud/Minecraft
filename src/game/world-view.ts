import * as THREE from 'three';
import type { CellData } from '../sim/world/district';
import { MeshBuilder } from './geometry';

/**
 * Renders resident cells. It only reacts to sim events (cell_loaded / cell_unloaded) and reads
 * CellData; it never changes simulation state. Builds are queued and throttled per frame to avoid hitches.
 */
export interface CellSource {
  getCell(cx: number, cz: number): CellData | undefined;
}

const MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true });
const MAX_BUILDS_PER_FRAME = 2;

export class WorldView {
  private readonly group = new THREE.Group();
  private readonly meshes = new Map<string, THREE.Mesh>();
  private readonly queue: Array<[number, number]> = [];
  private readonly queued = new Set<string>();
  private readonly source: CellSource;

  constructor(scene: THREE.Scene, source: CellSource) {
    this.source = source;
    scene.add(this.group);
  }

  get loadedMeshCount(): number {
    return this.meshes.size;
  }

  get pendingBuilds(): number {
    return this.queue.length;
  }

  enqueue(cx: number, cz: number): void {
    const key = `${cx},${cz}`;
    if (this.meshes.has(key) || this.queued.has(key)) return;
    this.queued.add(key);
    this.queue.push([cx, cz]);
  }

  remove(cx: number, cz: number): void {
    const key = `${cx},${cz}`;
    this.queued.delete(key);
    const idx = this.queue.findIndex(([x, z]) => x === cx && z === cz);
    if (idx >= 0) this.queue.splice(idx, 1);
    const m = this.meshes.get(key);
    if (m) {
      this.group.remove(m);
      m.geometry.dispose();
      this.meshes.delete(key);
    }
  }

  /** Builds up to MAX_BUILDS_PER_FRAME queued cells. Returns the number built. */
  pump(): number {
    let built = 0;
    while (this.queue.length > 0 && built < MAX_BUILDS_PER_FRAME) {
      const [cx, cz] = this.queue.shift()!;
      const key = `${cx},${cz}`;
      this.queued.delete(key);
      const data = this.source.getCell(cx, cz);
      if (!data) continue; // unloaded before the build ran
      const mesh = new THREE.Mesh(this.buildGeometry(data), MATERIAL);
      mesh.name = `cell ${key}`;
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.group.add(mesh);
      this.meshes.set(key, mesh);
      built++;
    }
    return built;
  }

  private buildGeometry(data: CellData): THREE.BufferGeometry {
    const b = new MeshBuilder();
    // Ground under the whole cell (sidewalk tone), then block paving, roads, and buildings.
    const x0 = data.cx * 192;
    const z0 = data.cz * 192;
    b.flatRect(x0, z0, x0 + 192, z0 + 192, -0.02, 0xa9a396);
    for (const p of data.paving) b.flatRect(p.x0, p.z0, p.x1, p.z1, 0.0, 0x8e8a80);
    for (const r of data.roads) b.flatRect(r.x0, r.z0, r.x1, r.z1, 0.03, 0x3b3d42);
    for (const bl of data.buildings) b.box(bl.x0, 0, bl.z0, bl.x1, bl.height, bl.z1, bl.color);
    return b.build();
  }

  dispose(): void {
    for (const m of this.meshes.values()) m.geometry.dispose();
    this.meshes.clear();
    this.queue.length = 0;
    this.queued.clear();
    this.group.clear();
  }
}
