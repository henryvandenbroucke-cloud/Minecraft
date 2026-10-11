import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CameraRig } from '../src/game/camera-rig';
import { DEFAULT_SETTINGS } from '../src/sim/settings';
import { makeAabb } from '../src/sim/collision';

describe('camera (brief §10 subset)', () => {
  it('T-CAM-001 third-person arm shortens to stay in front of a wall instead of clipping through', () => {
    const cam = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
    const rig = new CameraRig(cam);
    rig.yaw = 0; // look toward +Z, so the camera sits toward -Z
    rig.pitch = -0.2;
    const wall = makeAabb(-10, 0, -3, 10, 10, -2.5); // wall between the player and the camera's natural spot
    rig.update(DEFAULT_SETTINGS, { x: 0, y: 0, z: 0 }, 0, [wall], { active: false, yaw: 0 }, true);
    // The wall face is at z = -2.5. The camera must stop on the player's side of it (z > -2.5),
    // not at the unobstructed 4.6 m distance (which would be near z = -4.5).
    expect(cam.position.z).toBeGreaterThan(-2.5);
    expect(cam.position.z).toBeLessThan(0);
  });

  it('T-CAM-001 without obstacles the camera sits at the configured distance behind and above the pivot', () => {
    const cam = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
    const rig = new CameraRig(cam);
    rig.yaw = 0;
    rig.pitch = -0.2;
    rig.update(DEFAULT_SETTINGS, { x: 0, y: 0, z: 0 }, 0, [], { active: false, yaw: 0 }, true);
    const d = Math.hypot(cam.position.x, cam.position.y - 1.5, cam.position.z);
    expect(d).toBeCloseTo(4.6, 2); // DEFAULT camera distance is 'mid'
    expect(cam.position.y).toBeGreaterThan(1.5);
  });

  it('T-CAM-001 first person places the eye at head height and looks along the view direction', () => {
    const cam = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
    const rig = new CameraRig(cam);
    rig.firstPerson = true;
    rig.yaw = 0.5;
    rig.pitch = 0;
    rig.update(DEFAULT_SETTINGS, { x: 3, y: 0, z: 4 }, 0, [], { active: false, yaw: 0 }, true);
    expect(cam.position.y).toBeCloseTo(1.6, 6);
    expect(cam.position.x).toBeCloseTo(3, 6);
  });
});
