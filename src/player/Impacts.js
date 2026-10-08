import * as THREE from 'three';

const MAX = 64, LIFE = 28, FADE = 4;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1), _roll = new THREE.Quaternion();

function holeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  // soft dark scorch ring, hard black hole, a few hairline cracks
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(0.22, 'rgba(10,8,6,0.95)');
  r.addColorStop(0.3, 'rgba(10,8,6,0)'); r.addColorStop(1, 'rgba(10,8,6,0)');
  // pale chipped plaster around the hole so it also reads on dark walls
  const pr = g.createRadialGradient(32, 32, 6, 32, 32, 26);
  pr.addColorStop(0, 'rgba(225,215,195,0.75)'); pr.addColorStop(1, 'rgba(225,215,195,0)');
  g.fillStyle = pr; g.fillRect(0, 0, 64, 64);
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(15,12,10,0.7)'; g.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + 0.3, l = 10 + (i * 7) % 14;
    g.beginPath(); g.moveTo(32 + Math.cos(a) * 5, 32 + Math.sin(a) * 5); g.lineTo(32 + Math.cos(a) * l, 32 + Math.sin(a) * l); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Bullet holes on walls and ground: one InstancedMesh (one draw call), ring buffer of MAX decals.
// A decal lives LIFE seconds and shrinks away during the last FADE seconds.
export class Impacts {
  constructor(game) {
    this.game = game;
    const mat = new THREE.MeshBasicMaterial({ map: holeTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: true });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, MAX);
    this.mesh.name = 'bulletHoles'; this.mesh.frustumCulled = false;
    this.age = new Float32Array(MAX).fill(1e9);
    this.size = new Float32Array(MAX);
    this.pos = new Float32Array(MAX * 3);
    this.quat = new Float32Array(MAX * 4);
    this.next = 0;
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < MAX; i++) this.mesh.setMatrixAt(i, _m);
    game.scene.add(this.mesh);
  }

  // Add a hole at point (x,y,z) on a surface with normal (nx,ny,nz).
  add(x, y, z, nx, ny, nz, size = 0.16) {
    const i = this.next; this.next = (this.next + 1) % MAX;
    _n.set(nx, ny, nz);
    _q.setFromUnitVectors(_z, _n);
    _roll.setFromAxisAngle(_z, Math.random() * 6.283); _q.multiply(_roll);
    this.age[i] = 0; this.size[i] = size * (0.8 + Math.random() * 0.5);
    this.pos[i * 3] = x + nx * 0.015; this.pos[i * 3 + 1] = y + ny * 0.015; this.pos[i * 3 + 2] = z + nz * 0.015;
    this.quat[i * 4] = _q.x; this.quat[i * 4 + 1] = _q.y; this.quat[i * 4 + 2] = _q.z; this.quat[i * 4 + 3] = _q.w;
    this.write(i, 1);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  write(i, k) {
    _p.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
    _q.set(this.quat[i * 4], this.quat[i * 4 + 1], this.quat[i * 4 + 2], this.quat[i * 4 + 3]);
    const s = this.size[i] * k; _s.set(s, s, s);
    _m.compose(_p, _q, _s); this.mesh.setMatrixAt(i, _m);
  }

  update(dt) {
    let dirty = false;
    for (let i = 0; i < MAX; i++) {
      if (this.age[i] > LIFE) continue;
      this.age[i] += dt;
      const left = LIFE - this.age[i];
      if (left <= 0) { this.write(i, 0); dirty = true; this.age[i] = 1e9; }
      else if (left < FADE) { this.write(i, left / FADE); dirty = true; }
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
