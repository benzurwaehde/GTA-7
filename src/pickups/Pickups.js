import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CITY, blockBounds } from '../core/config.js';

const RESPAWN = 60, TAKE_R = 1.7, HOVER = 0.95;
const TYPES = {
  health: { color: '#3dff6a', hex: 0x3dff6a },
  armor: { color: '#3d9bff', hex: 0x3d9bff },
  ammo: { color: '#ffd24a', hex: 0xffd24a },
};

// tiny deterministic RNG so the pickups sit at the same places every run
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

function box(w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z);
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  return g;
}
function shapes() {
  return {
    // white case with a green cross
    health: mergeGeometries([box(0.8, 0.8, 0.16, 0, 0, 0, 0xf4f4f4), box(0.5, 0.15, 0.22, 0, 0, 0, 0x16c94a), box(0.15, 0.5, 0.22, 0, 0, 0, 0x16c94a)]),
    // blue vest: body, two shoulder straps, lighter stripe
    armor: mergeGeometries([box(0.62, 0.55, 0.3, 0, -0.1, 0, 0x2a6cff), box(0.16, 0.3, 0.3, -0.2, 0.3, 0, 0x2a6cff), box(0.16, 0.3, 0.3, 0.2, 0.3, 0, 0x2a6cff), box(0.64, 0.1, 0.32, 0, -0.1, 0, 0x9fd0ff)]),
    // yellow ammo box with a dark band and a lid
    ammo: mergeGeometries([box(0.7, 0.42, 0.42, 0, 0, 0, 0xffc41f), box(0.14, 0.44, 0.44, 0, 0, 0, 0x3a2f12), box(0.72, 0.08, 0.44, 0, 0.25, 0, 0xffe27a)]),
  };
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(0.5, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Health / armor / ammo pickups. Five instanced draw calls in total (3 bodies + glow discs + light beams).
export class Pickups {
  constructor(game) {
    this.game = game;
    this.items = [];            // { type, x, z, color, active, timer, pop }
    this.t = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(); this._e = new THREE.Euler(); this._c = new THREE.Color();
    this.place();
    this.build();
  }

  place() {
    const rnd = rng(7), used = new Set(), list = [];
    const types = ['health', 'armor', 'ammo'];
    const edge = (i, j) => {                       // a point on the sidewalk along a random edge of block (i, j)
      const b = blockBounds(i, j), side = (rnd() * 4) | 0, t = 6 + rnd() * (CITY.blockSize - 12), o = 1.6;
      return { x: side === 2 ? b.minX + o : side === 3 ? b.maxX - o : b.minX + t, z: side === 0 ? b.minZ + o : side === 1 ? b.maxZ - o : b.minZ + t };
    };
    // the three blocks next to the start get one pickup each (a new player finds them), the rest is spread over the city
    const sp = this.game.world?.getSpawnPoint?.() || { x: 0, z: 0 };
    const near = [];
    for (let i = 0; i < CITY.blocks; i++) for (let j = 0; j < CITY.blocks; j++) {
      const b = blockBounds(i, j); near.push({ i, j, d: Math.hypot((b.minX + b.maxX) / 2 - sp.x, (b.minZ + b.maxZ) / 2 - sp.z) });
    }
    near.sort((a, c) => a.d - c.d);
    for (let k = 0; k < 3; k++) { used.add(near[k].i * 16 + near[k].j); list.push({ type: types[k], ...edge(near[k].i, near[k].j) }); }
    while (list.length < 15) {
      const i = (rnd() * CITY.blocks) | 0, j = (rnd() * CITY.blocks) | 0, key = i * 16 + j;
      if (used.has(key)) continue; used.add(key);
      list.push({ type: types[list.length % 3], ...edge(i, j) });
    }
    for (const l of list) this.items.push({ ...l, color: TYPES[l.type].color, active: true, timer: 0, pop: 1 });
  }

  build() {
    const g = this.group = new THREE.Group(); g.name = 'pickups'; this.game.scene.add(g);
    const geo = shapes(), mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.bodies = {};
    for (const type of Object.keys(TYPES)) {
      const n = this.items.filter(i => i.type === type).length;
      const m = new THREE.InstancedMesh(geo[type], mat, n); m.frustumCulled = false; m.name = 'pickup_' + type;
      g.add(m); this.bodies[type] = { mesh: m, items: this.items.filter(i => i.type === type) };
    }
    const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false };
    const disc = new THREE.CircleGeometry(1.3, 24); disc.rotateX(-Math.PI / 2);
    this.glow = new THREE.InstancedMesh(disc, new THREE.MeshBasicMaterial({ ...add, map: glowTexture(), opacity: 0.9 }), this.items.length);
    const beamG = new THREE.CylinderGeometry(0.45, 0.45, 3.2, 12, 1, true); beamG.translate(0, 1.6, 0);
    this.beam = new THREE.InstancedMesh(beamG, new THREE.MeshBasicMaterial({ ...add, opacity: 0.16, side: THREE.DoubleSide }), this.items.length);
    for (const m of [this.glow, this.beam]) { m.frustumCulled = false; g.add(m); m.renderOrder = 5; }
    this.items.forEach((it, i) => { const c = this._c.setHex(TYPES[it.type].hex); this.glow.setColorAt(i, c); this.beam.setColorAt(i, c); });
    this.writeStatic();
  }

  writeStatic() {
    const { _m, _q, _p, _s } = this;
    this.items.forEach((it, i) => {
      const k = it.active ? 1 : 0;
      _p.set(it.x, 0.05, it.z); _s.set(k, k, k); _m.compose(_p, _q.identity(), _s);
      this.glow.setMatrixAt(i, _m);
      _p.set(it.x, 0, it.z); _m.compose(_p, _q.identity(), _s);
      this.beam.setMatrixAt(i, _m);
    });
    this.glow.instanceMatrix.needsUpdate = true; this.beam.instanceMatrix.needsUpdate = true;
  }

  getBlips() { return this.items.filter(i => i.active); }

  take(it, p) {
    const g = this.game, say = t => g.events.emit('hud:message', { text: t, duration: 2 });
    if (it.type === 'health') {
      if ((p.health ?? 100) >= 100) return false;
      p.heal?.(35); say('+35 Health');
    } else if (it.type === 'armor') {
      if ((p.armor ?? 0) >= 100) return false;
      p.addArmor?.(50); say('+50 Armor');
    } else {
      p.addAmmo?.('pistol', 24); p.addAmmo?.('smg', 60); say('+ Ammo');
    }
    g.audio?.play?.('pickup', { x: it.x, z: it.z });
    it.active = false; it.timer = RESPAWN; it.pop = 0;
    this.writeStatic();
    return true;
  }

  update(dt) {
    this.t += dt;
    const pl = this.game.player, pos = pl?.position;
    const { _m, _q, _p, _s, _e } = this;
    for (const body of Object.values(this.bodies)) {
      body.items.forEach((it, i) => {
        if (!it.active) {
          it.timer -= dt;
          if (it.timer <= 0) { it.active = true; it.pop = 0; this.writeStatic(); }
        } else if (pos && pl.alive !== false) {
          const dx = pos.x - it.x, dz = pos.z - it.z;
          if (dx * dx + dz * dz < TAKE_R * TAKE_R && pos.y < 2.5) this.take(it, pl);
        }
        if (it.active && it.pop < 1) it.pop = Math.min(1, it.pop + dt * 3);
        const k = it.active ? it.pop : 0;
        _p.set(it.x, HOVER + Math.sin(this.t * 2 + it.x) * 0.12, it.z);
        _q.setFromEuler(_e.set(0, this.t * 1.6 + it.z, 0)); _s.set(k, k, k);
        _m.compose(_p, _q, _s); body.mesh.setMatrixAt(i, _m);
      });
      body.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
