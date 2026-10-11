import * as THREE from 'three';
import type { CarState } from '../sim/vehicle';
import type { OnFootState } from '../sim/player';
import { MeshBuilder } from './geometry';

/** Placeholder figure: original blocky character tinted for the protagonist's colour key. */
export class FigureView {
  readonly group = new THREE.Group();
  private phase = 0;

  constructor(tint: number) {
    const b = new MeshBuilder();
    b.box(-0.22, 0.85, -0.14, 0.22, 1.45, 0.14, tint); // torso
    b.box(-0.2, 0.0, -0.12, -0.02, 0.9, 0.12, 0x2b2f38); // left leg
    b.box(0.02, 0.0, -0.12, 0.2, 0.9, 0.12, 0x2b2f38); // right leg
    b.box(-0.3, 0.9, -0.12, -0.22, 1.4, 0.12, 0xd9b48f); // arms (simplified)
    b.box(0.22, 0.9, -0.12, 0.3, 1.4, 0.12, 0xd9b48f);
    b.box(-0.13, 1.5, -0.13, 0.13, 1.72, 0.13, 0xd9b48f); // head
    const mesh = new THREE.Mesh(b.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.name = 'figure';
    this.group.add(mesh);
    this.group.userData.kind = 'figure';
  }

  /** Positions the figure. A small vertical bob stands in for a gait animation (animation rigs are a gap). */
  sync(p: OnFootState, moving: boolean, dt: number): void {
    if (moving) this.phase += dt * 9;
    const bob = moving ? Math.abs(Math.sin(this.phase)) * 0.04 : 0;
    this.group.position.set(p.x, p.y + bob, p.z);
    this.group.rotation.y = p.yaw;
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}

/** Kestrel GT placeholder: original blocky sports coupe. Nose is +Z to match the sim's yaw convention. */
export class CarView {
  readonly group = new THREE.Group();
  private readonly headlights: THREE.Mesh[] = [];

  constructor() {
    const b = new MeshBuilder();
    const L = 4.4;
    const W = 1.9;
    b.box(-W / 2, 0.25, -L / 2, W / 2, 0.85, L / 2, 0xc8242b); // body
    b.box(-W / 2 + 0.2, 0.85, -L / 2 + 1.3, W / 2 - 0.2, 1.2, L / 2 - 1.1, 0x1c1f26); // cabin
    b.box(-W / 2 + 0.05, 0.36, L / 2 - 0.05, -0.55, 0.52, L / 2 + 0.02, 0xfff3c4); // headlight L
    b.box(0.55, 0.36, L / 2 - 0.05, W / 2 - 0.05, 0.52, L / 2 + 0.02, 0xfff3c4); // headlight R
    b.box(-W / 2 + 0.05, 0.36, -L / 2 - 0.02, -0.55, 0.52, -L / 2 + 0.05, 0x7a1316); // tail L
    b.box(0.55, 0.36, -L / 2 - 0.02, W / 2 - 0.05, 0.52, -L / 2 + 0.05, 0x7a1316); // tail R
    for (const [x, z] of [[-W / 2 - 0.05, -1.4], [W / 2 - 0.25, -1.4], [-W / 2 - 0.05, 1.4], [W / 2 - 0.25, 1.4]] as const) {
      b.box(x, 0, z - 0.35, x + 0.3, 0.6, z + 0.35, 0x151515); // wheels
    }
    const mesh = new THREE.Mesh(b.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.name = 'kestrel-body';
    this.group.add(mesh);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const x of [-0.8, 0.8]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.2), hlMat);
      beam.position.set(x, 0.44, 2.45);
      beam.visible = false;
      this.group.add(beam);
      this.headlights.push(beam);
    }
  }

  sync(c: CarState): void {
    this.group.position.set(c.x, 0, c.z);
    this.group.rotation.y = c.yaw;
    for (const h of this.headlights) h.visible = c.headlights;
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}
