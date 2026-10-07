// Smoke / fire particles (two InstancedMeshes) and explosion flashes.
import * as THREE from 'three';

const MAX = 260;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();

class Pool {
  constructor(scene, material, kind) {
    this.kind = kind;
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), material, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = MAX;
    for (let i = 0; i < MAX; i++) { this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); this.mesh.setColorAt(i, _c.setRGB(0, 0, 0)); }
    scene.add(this.mesh);
    this.life = new Float32Array(MAX); this.max = new Float32Array(MAX);
    this.pos = new Float32Array(MAX * 3); this.vel = new Float32Array(MAX * 3);
    this.s0 = new Float32Array(MAX); this.s1 = new Float32Array(MAX);
    this.next = 0; this.active = 0; this.dirty = false;
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1) {
    const i = this.next; this.next = (this.next + 1) % MAX;
    if (this.life[i] <= 0) this.active++;
    this.life[i] = this.max[i] = life;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3);
    this.s0[i] = s0; this.s1[i] = s1;
  }
  update(dt) {
    if (!this.active) return;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.active--; this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); continue; }
      const t = 1 - this.life[i] / this.max[i], k = i * 3;
      this.vel[k + 1] += (this.kind === 0 ? 0.6 : 1.2) * dt;
      const damp = Math.exp(-1.2 * dt);
      this.vel[k] *= damp; this.vel[k + 2] *= damp;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      let size = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      if (this.kind === 0 && t > 0.7) size *= 1 - (t - 0.7) / 0.3 * 0.8;
      _p.set(this.pos[k], this.pos[k + 1], this.pos[k + 2]); _s.setScalar(size);
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      if (this.kind === 0) { const g = 0.22 + t * 0.2; this.mesh.setColorAt(i, _c.setRGB(g, g, g)); }
      else { const f = 1 - t; this.mesh.setColorAt(i, _c.setRGB(f, 0.6 * f * f, 0.05 * f)); }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.smoke = new Pool(scene, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }), 0);
    this.fire = new Pool(scene, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 1);
    this.flashes = [];
    this.flashGeo = new THREE.SphereGeometry(1, 12, 8);
  }
  smokePuff(x, y, z, strength = 1) {
    this.smoke.emit(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.8, 1.5 + Math.random() * 1.5, (Math.random() - 0.5) * 0.8, 1.6 + Math.random() * 1.2, 0.35 * strength, 1.4 * strength);
  }
  firePuff(x, y, z) {
    this.fire.emit(x + (Math.random() - 0.5) * 1.0, y, z + (Math.random() - 0.5) * 1.0, (Math.random() - 0.5) * 0.8, 1 + Math.random() * 1.6, (Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 0.5, 0.5, 0.15);
  }
  explosion(x, y, z) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(this.flashGeo, mat);
    mesh.position.set(x, y + 0.8, z); this.scene.add(mesh);
    this.flashes.push({ mesh, mat, t: 0 });
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * 6.283, sp = 2 + Math.random() * 6;
      this.fire.emit(x, y + 0.8, z, Math.cos(a) * sp, 2 + Math.random() * 5, Math.sin(a) * sp, 0.6 + Math.random() * 0.7, 0.8, 0.2);
    }
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * 6.283, sp = 1 + Math.random() * 3;
      this.smoke.emit(x, y + 1, z, Math.cos(a) * sp, 2 + Math.random() * 3, Math.sin(a) * sp, 2 + Math.random() * 2, 1, 3.5);
    }
  }
  update(dt) {
    this.smoke.update(dt); this.fire.update(dt);
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]; f.t += dt;
      const k = f.t / 0.45;
      if (k >= 1) { this.scene.remove(f.mesh); f.mat.dispose(); this.flashes.splice(i, 1); continue; }
      f.mesh.scale.setScalar(1.5 + k * 6); f.mat.opacity = 0.95 * (1 - k);
    }
  }
}
