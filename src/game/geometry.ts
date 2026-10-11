import * as THREE from 'three';

/** Accumulates flat-shaded boxes and quads into one BufferGeometry (one draw call per cell and material). */
export class MeshBuilder {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];
  private readonly indices: number[] = [];

  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, hex: number): void {
    const c = new THREE.Color(hex);
    const faces: Array<{ n: [number, number, number]; v: Array<[number, number, number]> }> = [
      { n: [0, 1, 0], v: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]] },
      { n: [0, -1, 0], v: [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]] },
      { n: [0, 0, 1], v: [[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]] },
      { n: [0, 0, -1], v: [[x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z0]] },
      { n: [1, 0, 0], v: [[x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0]] },
      { n: [-1, 0, 0], v: [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]] },
    ];
    for (const f of faces) this.quad(f.v, f.n, c);
  }

  /** Horizontal quad at height y spanning [x0,x1]x[z0,z1]. */
  flatRect(x0: number, z0: number, x1: number, z1: number, y: number, hex: number): void {
    this.quad(
      [[x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]],
      [0, 1, 0],
      new THREE.Color(hex),
    );
  }

  private quad(v: Array<[number, number, number]>, n: [number, number, number], c: THREE.Color): void {
    const base = this.positions.length / 3;
    for (const p of v) {
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(n[0], n[1], n[2]);
      this.colors.push(c.r, c.g, c.b);
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.setIndex(this.indices);
    g.computeBoundingSphere();
    return g;
  }
}
