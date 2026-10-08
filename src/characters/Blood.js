// Blood: one pooled Points object for sprays (no per-frame allocation) and a pool of fading puddle quads.
import * as THREE from 'three';
import { surfaceY } from './surface.js';

const MAX_P = 220, MAX_PUDDLES = 24, PUDDLE_LIFE = 40;

export class Blood {
  constructor(scene) {
    this.group = new THREE.Group(); this.group.name = 'blood';
    scene?.add(this.group);
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX_P * 3); this.vel = new Float32Array(MAX_P * 3); this.life = new Float32Array(MAX_P); this.gy = new Float32Array(MAX_P);
    for (let i = 0; i < MAX_P; i++) this.pos[i * 3 + 1] = -100;
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(8, 8, 7, 0, 6.3); cx.fill();
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xb0121a, size: 0.12, sizeAttenuation: true, depthWrite: false, map: new THREE.CanvasTexture(c), alphaTest: 0.5 }));
    this.points.frustumCulled = false; this.points.visible = false;
    this.group.add(this.points);
    this.next = 0; this.live = 0;
    const pg = new THREE.PlaneGeometry(1, 1); pg.rotateX(-Math.PI / 2);
    const tex = blobTexture();
    this.puddles = [];
    for (let i = 0; i < MAX_PUDDLES; i++) {
      const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.visible = false; m.renderOrder = 1; this.group.add(m);
      this.puddles.push({ mesh: m, t: 0, size: 1, sx: 1, sz: 1, active: false });
    }
    this.pn = 0;
  }

  // Burst of droplets at p (world), mostly along dir (unit vector, optional).
  spray(p, dir, n = 14, speed = 3) {
    for (let k = 0; k < n; k++) {
      const i = this.next; this.next = (this.next + 1) % MAX_P;
      const o = i * 3;
      this.pos[o] = p.x; this.pos[o + 1] = p.y; this.pos[o + 2] = p.z;
      const s = speed * (0.35 + Math.random() * 0.9);
      this.vel[o] = (dir ? dir.x * s : 0) + (Math.random() - 0.5) * speed * 0.7;
      this.vel[o + 1] = (dir ? dir.y * s : 0) + Math.random() * speed * 0.6 + 0.4;
      this.vel[o + 2] = (dir ? dir.z * s : 0) + (Math.random() - 0.5) * speed * 0.7;
      this.life[i] = 0.5 + Math.random() * 0.6;
      this.gy[i] = surfaceY(p.x, p.z);
    }
    this.live = MAX_P; this.points.visible = true;
  }

  // Blood pool under a body; grows then fades.
  puddle(x, z, size = 1.1) {
    const q = this.puddles[this.pn]; this.pn = (this.pn + 1) % MAX_PUDDLES;
    q.mesh.position.set(x, surfaceY(x, z) + 0.025 + (this.pn % 5) * 0.002, z);
    q.mesh.rotation.y = Math.random() * 6.28;
    q.sx = 0.75 + Math.random() * 0.5; q.sz = 0.75 + Math.random() * 0.5;
    q.t = 0; q.size = size; q.active = true; q.mesh.visible = true; q.mesh.scale.set(0.1, 1, 0.1);
    q.mesh.material.opacity = 0.85;
  }

  update(dt) {
    if (this.live > 0) {
      let any = 0;
      for (let i = 0; i < MAX_P; i++) {
        if (this.life[i] <= 0) continue;
        const o = i * 3;
        this.life[i] -= dt;
        this.vel[o + 1] -= 14 * dt;
        this.pos[o] += this.vel[o] * dt; this.pos[o + 1] += this.vel[o + 1] * dt; this.pos[o + 2] += this.vel[o + 2] * dt;
        if (this.life[i] <= 0 || this.pos[o + 1] < this.gy[i] + 0.02) { this.life[i] = 0; this.pos[o + 1] = -100; continue; }
        any++;
      }
      this.points.geometry.attributes.position.needsUpdate = true;
      if (!any) { this.live = 0; this.points.visible = false; }
    }
    for (const q of this.puddles) {
      if (!q.active) continue;
      q.t += dt;
      const g = q.size * Math.min(1, 0.1 + q.t / 3);
      q.mesh.scale.set(g * q.sx, 1, g * q.sz);
      if (q.t > PUDDLE_LIFE - 10) q.mesh.material.opacity = 0.85 * Math.max(0, (PUDDLE_LIFE - q.t) / 10);
      if (q.t > PUDDLE_LIFE) { q.active = false; q.mesh.visible = false; }
    }
  }
}

// Irregular dark-red blob (overlapping discs plus a few satellite drops) on a transparent canvas.
function blobTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#5c0910';
  const disc = (px, py, r) => { x.beginPath(); x.arc(px, py, r, 0, 6.3); x.fill(); };
  disc(64, 64, 34);
  for (let i = 0; i < 9; i++) { const a = i * 0.7 + Math.sin(i * 12.9) * 0.5, d = 18 + (i * 37 % 17); disc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 12 + (i * 13 % 10)); }
  for (let i = 0; i < 6; i++) { const a = i * 1.1 + 0.3, d = 44 + (i * 29 % 12); disc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 3 + (i % 3)); }
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(150,15,25,0.35)'; disc(56, 58, 22);   // wet highlight
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
