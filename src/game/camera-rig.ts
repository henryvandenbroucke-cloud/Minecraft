import * as THREE from 'three';
import { raycastBoxes, type Aabb } from '../sim/collision';
import type { Settings } from '../sim/settings';
import type { Vec3 } from '../sim/units';

/**
 * Third- and first-person camera (brief §10 subset). Orbit yaw/pitch are shared with on-foot movement.
 * The third-person arm is shortened by a ray against static boxes so it does not clip into walls.
 * Limitations: no transition blends beyond exponential smoothing, no shoulder aim, no roof or tunnel logic.
 */
export const CAMERA_DISTANCE: Record<Settings['cameraDistance'], number> = { near: 2.8, mid: 4.6, far: 7.2 };

export class CameraRig {
  yaw = 0;
  pitch = -0.25;
  firstPerson = false;
  private readonly pos = new THREE.Vector3();
  private initialised = false;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  /** Mouse/gamepad look: radians per unit input. */
  look(dx: number, dy: number, sensitivity: number, invertY: boolean): void {
    this.yaw -= dx * 0.0025 * sensitivity;
    this.pitch = Math.max(-1.2, Math.min(0.2, this.pitch + (invertY ? 1 : -1) * dy * 0.0025 * sensitivity));
  }

  /**
   * Places the camera. target: feet position of the controlled body. boxes: static colliders near the target.
   * inVehicle/carYaw: first-person vehicle view sits at the driver seat and faces the car's heading.
   */
  update(
    settings: Settings,
    target: Vec3,
    dt: number,
    boxes: readonly Aabb[],
    vehicle: { active: boolean; yaw: number },
    smooth = true,
  ): void {
    this.camera.fov = settings.fov;
    this.camera.updateProjectionMatrix();
    if (this.firstPerson) {
      const head = vehicle.active
        ? { x: target.x + Math.sin(vehicle.yaw) * 0.25, y: target.y + 1.15, z: target.z + Math.cos(vehicle.yaw) * 0.25 }
        : { x: target.x, y: target.y + 1.6, z: target.z };
      this.pos.set(head.x, head.y, head.z);
      this.camera.position.copy(this.pos);
      const look = this.lookDir();
      this.camera.lookAt(head.x + look.x, head.y + look.y, head.z + look.z);
      this.initialised = true;
      return;
    }
    const pivot = { x: target.x, y: target.y + 1.5, z: target.z };
    const dist = CAMERA_DISTANCE[settings.cameraDistance];
    const dir = this.lookDir();
    // Camera sits behind the look direction, so offset along -dir.
    const back = { x: -dir.x, y: -dir.y, z: -dir.z };
    const hit = raycastBoxes(pivot, back, dist, boxes);
    const d = hit !== null ? Math.max(0.4, hit - 0.25) : dist;
    const desired = new THREE.Vector3(pivot.x + back.x * d, pivot.y + back.y * d, pivot.z + back.z * d);
    if (!this.initialised || !smooth) {
      this.pos.copy(desired);
      this.initialised = true;
    } else {
      // Exponential smoothing: ~0.12 s time constant.
      const a = 1 - Math.exp(-dt / 0.12);
      this.pos.lerp(desired, a);
    }
    this.camera.position.copy(this.pos);
    this.camera.lookAt(pivot.x, pivot.y, pivot.z);
  }

  /** Unit look direction from yaw and pitch. Yaw 0 looks toward +Z, matching the sim. */
  lookDir(): Vec3 {
    const cp = Math.cos(this.pitch);
    return { x: Math.sin(this.yaw) * cp, y: Math.sin(this.pitch), z: Math.cos(this.yaw) * cp };
  }
}
