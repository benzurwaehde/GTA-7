// Police helicopter (5 stars). Circles above the player at ~30 m, sweeps a searchlight over him and shoots.
// It can be shot down: weapons call hit(point, dmg) or hitRay(origin, dir, maxDist, dmg); at 0 HP it spins down, crashes,
// explodes and stays as a charred wreck for a while. Created and owned by Police.js (game.police.helicopter).
// Draw calls: ~8 (merged fuselage per material, 2 rotors, rotor blur disc) + searchlight cone + ground glow.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getModel } from '../core/assets.js';

const HP = 140, ALT = 30, ORBIT_R = 26, MAX_SPEED = 34, BODY_Y = 1.5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const _dn = new THREE.Vector3(0, -1, 0), _dir = new THREE.Vector3();

const std = (color, rough, metal) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
const MATS = {
  Paint: std(0x1b2b4d, 0.4, 0.3), Glass: std(0x10151c, 0.1, 0.6), Trim: std(0x1a1a1c, 0.8, 0),
  Headlight: new THREE.MeshBasicMaterial({ color: 0xfff0c0 }),
  Siren_Red: new THREE.MeshBasicMaterial({ color: 0xff2020 }), Siren_Blue: new THREE.MeshBasicMaterial({ color: 0x2f6bff }),
};
const WRECK = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.96, metalness: 0 });

// Distance (squared) from point to the segment a-b.
function distSqSeg(px, py, pz, ax, ay, az, bx, by, bz) {
  const abx = bx - ax, aby = by - ay, abz = bz - az, l2 = abx * abx + aby * aby + abz * abz || 1;
  const t = clamp(((px - ax) * abx + (py - ay) * aby + (pz - az) * abz) / l2, 0, 1);
  const dx = ax + abx * t - px, dy = ay + aby * t - py, dz = az + abz * t - pz;
  return dx * dx + dy * dy + dz * dz;
}

function bakeMesh(mesh) {
  const g = mesh.geometry.clone();
  g.applyMatrix4(mesh.matrixWorld);
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  return g.index ? g.toNonIndexed() : g;
}

// GLB -> { root, rotorMain, rotorTail, meshes[] }. Static parts are merged per material; the two rotors stay separate.
function buildFromGLB() {
  const src = getModel('vehicle_heli');
  if (!src) return null;
  src.updateMatrixWorld(true);
  const rotorMain = src.getObjectByName('rotor_main'), rotorTail = src.getObjectByName('rotor_tail');
  if (!rotorMain || !rotorTail) return null;
  const inRotor = o => { for (let p = o; p; p = p.parent) if (p === rotorMain || p === rotorTail) return true; return false; };
  const groups = {};
  src.traverse(o => {
    if (!o.isMesh || inRotor(o)) return;
    const name = (o.material?.name || 'Trim').replace(/\.\d+$/, '');
    (groups[name] || (groups[name] = [])).push(bakeMesh(o));
  });
  const root = new THREE.Group();
  const meshes = [];
  for (const name of Object.keys(groups)) {
    const geo = mergeGeometries(groups[name]);
    for (const g of groups[name]) g.dispose();
    const m = new THREE.Mesh(geo, MATS[name] || MATS.Trim);
    m.castShadow = name === 'Paint';
    root.add(m); meshes.push(m);
  }
  for (const r of [rotorMain, rotorTail]) {
    r.removeFromParent(); r.traverse(o => { if (o.isMesh) o.material = MATS.Trim; });
    root.add(r);
  }
  return { root, rotorMain, rotorTail, meshes };
}

// Fallback when the GLB is missing: a few boxes.
function buildProcedural() {
  const parts = [];
  const box = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); parts.push(g); };
  box(2.2, 1.7, 4.6, 0, 1.45, 0.4); box(0.3, 0.34, 4.2, 0, 1.6, -3.8); box(0.07, 1.3, 0.9, 0, 2.15, -5.7);
  box(0.09, 0.09, 3.6, 0.85, 0.12, 0.4); box(0.09, 0.09, 3.6, -0.85, 0.12, 0.4);
  const geo = mergeGeometries(parts); for (const g of parts) g.dispose();
  const root = new THREE.Group(), body = new THREE.Mesh(geo, MATS.Paint);
  root.add(body);
  const rb = new THREE.BoxGeometry(8.2, 0.05, 0.34), rb2 = rb.clone().rotateY(Math.PI / 2);
  const rotorMain = new THREE.Mesh(mergeGeometries([rb, rb2]), MATS.Trim); rotorMain.position.set(0, 2.95, 0.3);
  const rotorTail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.5, 0.12), MATS.Trim); rotorTail.position.set(0.13, 2.3, -5.85);
  root.add(rotorMain, rotorTail);
  return { root, rotorMain, rotorTail, meshes: [body] };
}

let glowTexture = null;
function glowTex() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c); glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

export class Helicopter {
  constructor(game, police) {
    this.game = game; this.police = police;
    const b = buildFromGLB() || buildProcedural();
    this.model = b;
    this.mesh = b.root; this.mesh.rotation.order = 'YXZ';
    this.rotorMain = b.rotorMain; this.rotorTail = b.rotorTail;
    this.position = this.mesh.position;
    this.vel = new THREE.Vector3();
    this.hp = HP;
    this.state = 'attack';            // attack | leave | crash | wreck
    this.dead = false;                // true when removed from the scene: Police drops its reference
    this.yaw = 0; this.pitch = 0; this.roll = 0;
    this.t = 0; this.orbit = Math.random() * 6.28; this.cd = 2; this.burst = 0; this.stateT = 0; this.puffT = 0;
    this.spot = new THREE.Vector3(); this.spinV = 0;
    this.roof = 0; this.roofT = 0; this._dt = 0;
    // rotor blur disc
    this.blur = new THREE.Mesh(new THREE.CircleGeometry(4.1, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xaab0b8, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }));
    this.blur.position.copy(this.rotorMain.position);
    this.mesh.add(this.blur);
    // searchlight: an open cone (bright at the ground end) plus a glow quad where it lands
    const cone = new THREE.ConeGeometry(1, 1, 20, 1, true), pa = cone.attributes.position, col = new Float32Array(pa.count * 3);
    for (let i = 0; i < pa.count; i++) { const k = 0.12 + 0.88 * (0.5 - pa.getY(i)); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k; }
    cone.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.cone = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: 0xfff2c8, vertexColors: true, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.cone.frustumCulled = false; this.cone.renderOrder = 6;
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xfff2c8, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    this.pool.frustumCulled = false; this.pool.renderOrder = 4;
  }

  // Appears 130 m away from the player at flight altitude, heading for him.
  start(pp) {
    const a = Math.random() * 6.283;
    this.position.set(pp.x + Math.cos(a) * 130, ALT + 8, pp.z + Math.sin(a) * 130);
    this.spot.set(pp.x, 0, pp.z);
    this.yaw = Math.atan2(pp.x - this.position.x, pp.z - this.position.z);
    const sc = this.game.scene; sc.add(this.mesh, this.cone, this.pool);
    this.game.events?.emit('hud:message', { text: 'Police helicopter!', duration: 2.5 });
  }

  leave() { if (this.state === 'attack') this.state = 'leave'; }

  // ---- weapons API ----------------------------------------------------------------------------
  // Point-in-capsule test (fuselage + tail boom, with ~0.6 m tolerance). point = {x, y, z}. Returns true if it hit.
  hit(point, dmg = 10) {
    if (this.state !== 'attack' && this.state !== 'leave') return false;
    if (!point) return false;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), p = this.position, y = p.y + BODY_Y;
    if (distSqSeg(point.x, point.y, point.z, p.x + fx * 2.0, y, p.z + fz * 2.0, p.x - fx * 3.2, y, p.z - fz * 3.2) > 2.6 * 2.6) return false;
    this._damage(dmg);
    return true;
  }
  // Ray vs sphere around the cabin (radius 3 m). Returns the hit distance along dir (unit vector) or Infinity.
  rayHit(origin, dir, maxDist = Infinity) {
    if (this.state !== 'attack' && this.state !== 'leave') return Infinity;
    const p = this.position, cx = p.x - origin.x, cy = p.y + BODY_Y - origin.y, cz = p.z - origin.z;
    const t = cx * dir.x + cy * dir.y + cz * dir.z;
    if (t < 0) return Infinity;
    const d2 = cx * cx + cy * cy + cz * cz - t * t, R = 3;
    if (d2 > R * R) return Infinity;
    const th = t - Math.sqrt(R * R - d2);
    return th <= maxDist ? Math.max(0, th) : Infinity;
  }
  // rayHit + damage in one call. Returns the distance (Infinity = miss).
  hitRay(origin, dir, maxDist, dmg = 10) {
    const t = this.rayHit(origin, dir, maxDist);
    if (t !== Infinity) this._damage(dmg);
    return t;
  }
  // Explosion at (x, y, z): damage falls off linearly with distance.
  blast(x, y, z, radius, dmg) {
    if (this.state !== 'attack' && this.state !== 'leave') return;
    const p = this.position, d = Math.hypot(p.x - x, p.y + BODY_Y - y, p.z - z);
    if (d < radius) this._damage(dmg * (1 - d / radius));
  }

  _damage(dmg) {
    this.hp -= dmg;
    this.game.audio?.play?.('crash', { x: this.position.x, z: this.position.z, volume: 0.3 });
    if (this.hp <= 0) this._crash();
  }

  _crash() {
    this.state = 'crash'; this.stateT = 0; this.spinV = 3;
    this.vel.y = Math.min(this.vel.y, 0);
    this.cone.visible = false; this.pool.visible = false;
    this.game.events?.emit('hud:message', { text: 'Helicopter down!', duration: 2.5 });
  }

  // ---- update ---------------------------------------------------------------------------------
  update(dt, pp) {
    if (this.dead) return;
    this.t += dt; this.stateT += dt;
    const p = this.position;
    if (this.state === 'attack' || this.state === 'leave') this._fly(dt, pp);
    else if (this.state === 'crash') this._fall(dt);
    else this._burn(dt);

    // rotors (stop on the wreck), rotor blur follows the speed
    const spin = this.state === 'wreck' ? 0 : this.state === 'crash' ? 22 : 34;
    this.rotorMain.rotation.y += spin * dt; this.rotorTail.rotation.x += spin * 1.3 * dt;
    this.blur.visible = this.state !== 'wreck';
    MATS.Siren_Red.color.setHex(((this.t * 3) | 0) % 2 ? 0xff2020 : 0x501010);
    MATS.Siren_Blue.color.setHex(((this.t * 3) | 0) % 2 ? 0x102050 : 0x2f6bff);

    this.mesh.rotation.set(this.pitch, this.yaw, this.roll);
    // damaged: bonnet smoke below 50 %, flames below 25 %
    if ((this.state === 'attack' || this.state === 'leave') && this.hp < HP * 0.5) {
      this.puffT -= dt;
      if (this.puffT <= 0) {
        this.puffT = 0.12;
        const fx = this.game.vehicles?.effects;
        fx?.smokePuff(p.x, p.y + 2.8, p.z, 1.3);
        if (this.hp < HP * 0.25) fx?.firePuff(p.x, p.y + 2.4, p.z);
      }
    }
  }

  // Highest building top within 16 m of (x, z); refreshed a few times per second (no per-frame scan).
  _rooftops(x, z) {
    this.roofT -= this._dt;
    if (this.roofT > 0) return this.roof;
    this.roofT = 0.3;
    const cols = this.game.world?.colliders;
    let top = 0;
    if (cols) for (let i = 0; i < cols.length; i++) {
      const b = cols[i];
      if (b.type !== 'building' || b.maxX < x - 16 || b.minX > x + 16 || b.maxZ < z - 16 || b.minZ > z + 16) continue;
      if (b.maxY > top) top = b.maxY;
    }
    return (this.roof = Math.min(top, 110));
  }

  _fly(dt, pp) {
    this._dt = dt;
    const p = this.position, v = this.vel, leaving = this.state === 'leave';
    let tx, tz, ty;
    if (leaving) {
      const dx = p.x - pp.x, dz = p.z - pp.z, l = Math.hypot(dx, dz) || 1;
      tx = p.x + dx / l * 200; tz = p.z + dz / l * 200; ty = ALT + 30;
    } else {
      this.orbit += 0.22 * dt;
      const pv = this.game.player?.vehicle;
      tx = pp.x + Math.cos(this.orbit) * ORBIT_R + (pv ? pv.vx : 0) * 1.1;
      tz = pp.z + Math.sin(this.orbit) * ORBIT_R + (pv ? pv.vz : 0) * 1.1;
      ty = Math.max(ALT, this._rooftops(tx, tz) + 9) + Math.sin(this.t * 0.7) * 2;   // stay above the roofs
    }
    let dx = (tx - p.x) * 0.7, dy = (ty - p.y) * 0.7, dz = (tz - p.z) * 0.7;
    const l = Math.hypot(dx, dy, dz), top = leaving ? MAX_SPEED * 1.3 : MAX_SPEED;
    if (l > top) { dx *= top / l; dy *= top / l; dz *= top / l; }
    const k = Math.min(1, dt * 1.3);
    v.x += (dx - v.x) * k; v.y += (dy - v.y) * k; v.z += (dz - v.z) * k;
    p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;

    const want = leaving ? Math.atan2(v.x, v.z) : Math.atan2(pp.x - p.x, pp.z - p.z);
    this.yaw += clamp(wrap(want - this.yaw), -2.2 * dt, 2.2 * dt);
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const vf = v.x * sy + v.z * cy, vr = -v.x * cy + v.z * sy, kk = Math.min(1, dt * 3);
    this.pitch += (clamp(vf * 0.012, -0.3, 0.35) - this.pitch) * kk;       // nose down when speeding up
    this.roll += (clamp(vr * 0.02, -0.4, 0.4) - this.roll) * kk;           // banks into sideways drift

    // searchlight sweeps after the player with a little lag
    const sk = Math.min(1, dt * 2.2);
    this.spot.x += (pp.x - this.spot.x) * sk; this.spot.z += (pp.z - this.spot.z) * sk;
    const lx = p.x + sy * 2.1, ly = p.y + 0.4, lz = p.z + cy * 2.1;
    _dir.set(this.spot.x - lx, -ly, this.spot.z - lz);
    const len = _dir.length(), r = len * 0.11 + 0.4;
    _dir.multiplyScalar(1 / len);
    this.cone.position.set(lx + _dir.x * len * 0.5, ly + _dir.y * len * 0.5, lz + _dir.z * len * 0.5);
    this.cone.quaternion.setFromUnitVectors(_dn, _dir);
    this.cone.scale.set(r, len, r);
    this.pool.position.set(this.spot.x, 0.14, this.spot.z); this.pool.scale.set(r * 2.6, 1, r * 2.6);
    const nf = this.game.vehicles?.nightF ?? 0;
    this.cone.material.opacity = 0.06 + 0.16 * nf;
    this.pool.material.opacity = 0.2 + 0.5 * nf;
    this.cone.visible = this.pool.visible = !leaving || len < 140;

    // machine gun
    this.cd -= dt;
    if (!leaving && this.cd <= 0) {
      const ddx = pp.x - p.x, ddz = pp.z - p.z, d = Math.hypot(ddx, ddz);
      if (d < 80 && this.police.grid.lineClear(p.x, p.z, pp.x, pp.z)) this._shoot(lx, ly, lz, pp, d);
      else this.cd = 0.4;
    }
  }

  _shoot(lx, ly, lz, pp, d) {
    const g = this.game, pv = g.player?.vehicle;
    if (this.burst <= 0) this.burst = 3 + ((Math.random() * 3) | 0);
    this.burst--;
    this.cd = this.burst > 0 ? 0.14 : 1.1 + Math.random() * 0.8;
    let chance = 0.3 - d * 0.0018;
    if (pv && Math.abs(pv.speed) > 8) chance *= 0.5;
    chance = clamp(chance, 0.06, 0.3);
    const hit = Math.random() < chance;
    let tx = pp.x, tz = pp.z;
    if (!hit) { tx += (Math.random() - 0.5) * 5; tz += (Math.random() - 0.5) * 5; }
    this.police._tracer(lx, ly - 0.2, lz, tx, pv ? 1.0 : 1.1, tz);
    g.audio?.play?.('gunshot', { x: lx, z: lz });
    if (this.burst === 0) g.peds?.scare?.(lx, lz, 30);
    if (hit) g.player?.damage?.(4 + Math.floor(Math.random() * 3), 'police');
  }

  _fall(dt) {
    const p = this.position, v = this.vel;
    v.y -= 11 * dt; v.x *= Math.exp(-0.25 * dt); v.z *= Math.exp(-0.25 * dt);
    p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
    this.spinV = Math.min(8, this.spinV + 3 * dt);
    this.yaw += this.spinV * dt; this.roll += 1.1 * dt; this.pitch += (0.45 - this.pitch) * Math.min(1, dt * 2);
    this.puffT -= dt;
    if (this.puffT <= 0) {
      this.puffT = 0.05;
      const fx = this.game.vehicles?.effects;
      fx?.smokePuff(p.x, p.y + 2.4, p.z, 1.6); fx?.firePuff(p.x, p.y + 2.0, p.z);
    }
    if (p.y <= 0.1 || this.stateT > 8) this._explode();
  }

  _explode() {
    const g = this.game, p = this.position;
    p.y = 0;
    g.vehicles?.effects?.explosion?.(p.x, 0, p.z, 0x1b2b4d);
    g.audio?.play?.('explosion', { x: p.x, z: p.z });
    const pl = g.player;
    if (pl?.position) {
      const d = Math.hypot(pl.position.x - p.x, pl.position.z - p.z);
      if (d < 11) pl.damage?.(60 * (1 - d / 11), 'explosion');
    }
    const peds = g.peds?.list;
    if (peds) for (let i = 0; i < peds.length; i++) {
      const o = peds[i];
      if (!o.position || o.state === 'dead') continue;
      if (Math.hypot(o.position.x - p.x, o.position.z - p.z) < 9) g.peds.damage?.(o, 100, 'explosion');
    }
    const cars = g.vehicles?.list;
    if (cars) for (let i = 0; i < cars.length; i++) {
      const o = cars[i];
      if (o.destroyed) continue;
      const d = Math.hypot(o.position.x - p.x, o.position.z - p.z);
      if (d < 9) g.vehicles.damage?.(o, 70 * (1 - d / 9));
    }
    this.mesh.traverse(o => { if (o.isMesh && o !== this.blur) o.material = WRECK; });
    this.state = 'wreck'; this.stateT = 0; this.pitch = 0.1; this.roll = 0.5;
    this.vel.set(0, 0, 0);
    g.events?.emit('helicopter:destroyed', { position: p });
  }

  _burn(dt) {
    const p = this.position;
    this.puffT -= dt;
    if (this.stateT < 14 && this.puffT <= 0) {
      this.puffT = this.stateT < 6 ? 0.1 : 0.35;
      const fx = this.game.vehicles?.effects;
      fx?.smokePuff(p.x, 1.8, p.z, 1.4);
      if (this.stateT < 6) fx?.firePuff(p.x, 1.2, p.z);
    }
    if (this.stateT > 35) this.dispose();
  }

  dispose() {
    if (this.dead) return;
    this.dead = true;
    const sc = this.game.scene;
    sc.remove(this.mesh, this.cone, this.pool);
    this.mesh.traverse(o => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    this.cone.geometry.dispose(); this.cone.material.dispose(); this.pool.geometry.dispose(); this.pool.material.dispose();
  }
}
