import * as THREE from 'three';
import { rayBox } from '../core/physics.js';

export const lerpAngle = (a, b, t) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

// Orbit camera: on foot = over-the-shoulder third person; in vehicle = chase camera that re-aligns behind the car.
export class CameraRig {
  constructor(game) {
    this.game = game;
    this.yaw = 0; this.pitch = 0.25;
    this.dist = 4.6; this.sens = 0.0023;
    this.idle = 10;        // seconds since the mouse last moved
    this.target = new THREE.Vector3();
    this.fov = 65;
    this.ready = false;
  }

  // yaw: set camera behind a heading immediately
  snap(heading) { this.yaw = heading; this.pitch = 0.25; this.ready = false; }

  update(dt, focus, { vehicle = null, colliders = null } = {}) {
    const g = this.game, m = g.input.mouse;
    if (m.locked && (m.dx || m.dy)) {
      this.yaw -= m.dx * this.sens;
      this.pitch = Math.max(-0.35, Math.min(1.25, this.pitch + m.dy * this.sens));
      this.idle = 0;
    } else this.idle += dt;

    let wantDist, height, wantPitch = null, fov = 65, shoulder = 0;
    if (vehicle) {
      const sp = Math.abs(vehicle.speed || 0);
      wantDist = 7.2 + Math.min(sp, 40) * 0.13;
      height = 1.3; wantPitch = 0.22; fov = 65 + Math.min(sp, 45) * 0.35;
      if (this.idle > 1.2) {
        const k = 1 - Math.exp(-dt * 2.5);
        this.yaw = lerpAngle(this.yaw, vehicle.heading || 0, k);
        this.pitch += (wantPitch - this.pitch) * k;
      }
    } else { wantDist = 4.6; height = 1.55; shoulder = 0.55; }

    // look-at target (with shoulder offset on foot)
    const rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw);
    const tx = focus.x + rx * shoulder, ty = focus.y + height, tz = focus.z + rz * shoulder;
    if (!this.ready) { this.target.set(tx, ty, tz); }
    else { const k = 1 - Math.exp(-dt * (vehicle ? 14 : 22)); this.target.x += (tx - this.target.x) * k; this.target.y += (ty - this.target.y) * k; this.target.z += (tz - this.target.z) * k; }

    const cp = Math.cos(this.pitch), sp2 = Math.sin(this.pitch);
    const dx = -Math.sin(this.yaw) * cp, dy = sp2, dz = -Math.cos(this.yaw) * cp;

    // collision: shorten along ray against buildings
    let d = wantDist;
    if (colliders) for (const b of colliders) {
      if (b.maxY !== undefined && b.maxY < ty + dy * wantDist * 0.5 && b.maxY < 2) continue;
      const hlen = Math.hypot(dx, dz) || 1;
      const t = rayBox(this.target.x, this.target.z, dx / hlen, dz / hlen, b);
      const t3 = t / hlen; // convert 2D distance to 3D ray param
      if (t3 < d) d = Math.max(0.6, t3 - 0.35);
    }
    if (!this.ready) { this.curDist = d; this.ready = true; }
    this.curDist = d < this.curDist ? d : this.curDist + (d - this.curDist) * (1 - Math.exp(-dt * 3));

    const cam = g.camera;
    cam.position.set(this.target.x + dx * this.curDist, Math.max(0.5, this.target.y + dy * this.curDist), this.target.z + dz * this.curDist);
    cam.lookAt(this.target);
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * (1 - Math.exp(-dt * 4)); cam.updateProjectionMatrix(); }
  }
}
