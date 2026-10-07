import * as THREE from 'three';
import { rayBox } from '../core/physics.js';

export const WEAPON_DEFS = [
  { id: 'fists', name: 'Fists', melee: true, damage: 18, rate: 0.42, range: 1.9, ammo: Infinity, auto: false },
  { id: 'pistol', name: 'Pistol', damage: 26, rate: 0.28, range: 90, ammo: 48, clipSize: 12, reload: 1.3, auto: false, spread: 0.012, sound: 'gunshot', vehDmg: 10, kick: 0.016, shake: 0.12 },
  { id: 'smg', name: 'SMG', damage: 11, rate: 0.085, range: 80, ammo: 150, clipSize: 30, reload: 1.9, auto: true, spread: 0.03, sound: 'smg', vehDmg: 4, kick: 0.009, shake: 0.08 },
];

const _v = new THREE.Vector3();
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _o2 = new THREE.Vector3(), _d2 = new THREE.Vector3();
// reusable result of castRay (no per-shot allocations)
const HIT = { dist: 0, kind: null, target: null, point: new THREE.Vector3() };

// Weapon inventory + hitscan + visual effects (muzzle flash, tracers, sparks).
export class Weapons {
  constructor(game, player) {
    this.game = game; this.player = player;
    // ammo = reserve; clip = rounds in the magazine
    this.states = WEAPON_DEFS.map(d => d.melee
      ? { id: d.id, name: d.name, ammo: d.ammo, clip: Infinity, clipSize: Infinity, reloading: false }
      : { id: d.id, name: d.name, ammo: d.ammo - d.clipSize, clip: d.clipSize, clipSize: d.clipSize, reloading: false });
    this.reloadT = 0; this.bloom = 0;
    this.index = 1;
    this.cooldown = 0;
    this.noAmmoMsg = 0;

    const g = this.fx = new THREE.Group(); g.name = 'weaponFx'; game.scene.add(g);
    // muzzle flash: two crossed additive planes
    const fm = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.flash = new THREE.Group();
    for (const r of [0, Math.PI / 2]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), fm); p.rotation.z = r; this.flash.add(p); }
    const cone = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.55), fm); cone.rotation.y = Math.PI / 2; cone.position.z = 0.2; this.flash.add(cone);
    this.flash.visible = false; this.flashT = 0; g.add(this.flash);
    // tracers
    this.tracers = [];
    const tm = new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.9, depthWrite: false });
    const tg = new THREE.BoxGeometry(0.025, 0.025, 1);
    for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(tg, tm.clone()); m.visible = false; m.life = 0; g.add(m); this.tracers.push(m); }
    this.tracerI = 0;
    // sparks
    this.sparks = [];
    const sg = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true }));
      m.visible = false; m.life = 0; m.vel = new THREE.Vector3(); g.add(m); this.sparks.push(m);
    }
    this.sparkI = 0;
  }

  get current() { return this.states[this.index]; }
  get def() { return WEAPON_DEFS[this.index]; }

  select(i) {
    const n = this.states.length;
    this.index = ((i % n) + n) % n;
    this.cooldown = Math.max(this.cooldown, 0.15);
    for (const st of this.states) { st.reloading = false; }
    this.reloadT = 0;
    this.player.character.setWeapon(this.def.melee ? null : this.def.id);
    this.player.weapon = this.current;
    this.game.events.emit('weapon:changed', { weapon: this.current });
  }
  cycle(dir) { this.select(this.index + dir); }
  addAmmo(id, n) { const s = this.states.find(s => s.id === id); if (s && Number.isFinite(s.ammo)) s.ammo += n; }

  // Start reloading the current weapon (manual R or automatic on empty clip).
  startReload() {
    const st = this.current, d = this.def;
    if (d.melee || st.reloading || st.clip >= st.clipSize || st.ammo <= 0) return false;
    st.reloading = true; this.reloadT = d.reload;
    this.game.audio?.play?.('reload', { x: this.player.position.x, z: this.player.position.z });
    return true;
  }
  // 0..1 progress of the running reload, or -1
  get reloadProgress() { return this.current.reloading ? 1 - this.reloadT / this.def.reload : -1; }

  // Nearest hit along a 3D ray (unit dir): walls (height-aware), peds, vehicles, ground. Fills and returns HIT.
  castRay(o, d, maxDist) {
    const g = this.game, p = this.player;
    let dist = maxDist, kind = null, target = null;
    const hl = Math.hypot(d.x, d.z);
    const colliders = g.world?.colliders;
    if (colliders && hl > 1e-6) for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      const t2 = rayBox(o.x, o.z, d.x / hl, d.z / hl, b);
      if (t2 === Infinity) continue;
      const t = t2 / hl;
      if (t >= dist) continue;
      const y = o.y + d.y * t;
      if (y > (b.maxY ?? Infinity) || y < (b.minY ?? -1)) continue;
      dist = t; kind = 'wall';
    }
    const ph = g.peds?.hitTest?.(o, d, dist);
    if (ph && ph.ped && ph.dist <= dist) { dist = ph.dist; kind = 'ped'; target = ph.ped; }
    const list = g.vehicles?.list;
    if (list && hl > 1e-6) for (let i = 0; i < list.length; i++) {
      const v = list[i];
      if (!v || v.destroyed || v === p.vehicle || !v.position) continue;
      const t2 = rayCircle(o.x, o.z, d.x / hl, d.z / hl, v.position.x, v.position.z, v.radius || 2);
      const t = t2 / hl;
      if (t >= dist) continue;
      const y = o.y + d.y * t;
      if (y < 0 || y > 1.8) continue;
      dist = t; kind = 'vehicle'; target = v;
    }
    if (d.y < -1e-4) { const tg = -o.y / d.y; if (tg > 0 && tg < dist) { dist = tg; kind = 'ground'; target = null; } }
    HIT.dist = dist; HIT.kind = kind; HIT.target = target;
    HIT.point.copy(o).addScaledVector(d, dist);
    return HIT;
  }

  update(dt, wantFire, firePressed, aimYaw) {
    this.cooldown -= dt;
    // effects
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flash.visible = false; }
    for (const t of this.tracers) if (t.life > 0) { t.life -= dt; t.material.opacity = Math.max(0, t.life / 0.07) * 0.9; if (t.life <= 0) t.visible = false; }
    for (const s of this.sparks) if (s.life > 0) {
      s.life -= dt; s.vel.y -= 14 * dt; s.position.addScaledVector(s.vel, dt);
      s.material.opacity = Math.max(0, s.life / 0.35); if (s.life <= 0 || s.position.y < 0) { s.visible = false; s.life = 0; }
    }
    if (this.flash.visible) this.player.character.muzzleObject.getWorldPosition(this.flash.position);

    this.bloom = Math.max(0, this.bloom - dt * 0.05);
    const d = this.def, st = this.current;
    if (st.reloading) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const n = Math.min(st.clipSize - st.clip, st.ammo);
        st.clip += n; st.ammo -= n; st.reloading = false;
      }
      return false;
    }
    const trigger = d.auto ? wantFire : firePressed;
    if (!trigger || this.cooldown > 0) return false;
    if (!d.melee && st.clip <= 0) {
      if (st.ammo > 0) this.startReload();
      else if (firePressed) {
        this.cooldown = 0.25;
        this.game.audio?.play?.('empty', { x: this.player.position.x, z: this.player.position.z });
        if (this.game.time - this.noAmmoMsg > 1) { this.noAmmoMsg = this.game.time; this.game.events.emit('hud:message', { text: `${d.name}: out of ammo`, duration: 1.5 }); }
      }
      return false;
    }
    this.cooldown = d.rate;
    if (d.melee) this.punch(d, aimYaw); else this.shoot(d);
    return true;
  }

  punch(d, yaw) {
    const p = this.player, g = this.game;
    p.character.punch();
    g.audio?.play?.('punch', { x: p.position.x, z: p.position.z });
    const origin = _v.set(p.position.x, p.position.y + 1.2, p.position.z).clone();
    const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const hit = g.peds?.hitTest?.(origin, dir, d.range);
    if (hit?.ped) {
      g.peds.damage?.(hit.ped, d.damage, 'player');
      g.audio?.play?.('hit', { x: hit.point?.x ?? p.position.x, z: hit.point?.z ?? p.position.z });
      if (hit.point) this.spark(hit.point, 6, 0xff6a5a);
    }
  }

  // Current spread (radians) for the crosshair: base + recent-fire bloom, tighter when aiming.
  spread(aiming) {
    const d = this.def;
    return (d.spread || 0) * (aiming ? 0.45 : 1) + this.bloom;
  }

  shoot(d) {
    const p = this.player, g = this.game, cam = p.cam;
    this.current.clip--;
    const sp = this.spread(p.aimK > 0.5);
    // 1) camera ray through the screen centre (+ spread) finds the aim point under the crosshair
    _d.copy(cam.aimDir);
    _d.x += (Math.random() - 0.5) * 2 * sp; _d.y += (Math.random() - 0.5) * 2 * sp; _d.z += (Math.random() - 0.5) * 2 * sp;
    _d.normalize();
    const skip = cam.curDist || 0; // ignore everything between camera and player
    _o.copy(cam.aimOrigin).addScaledVector(_d, skip);
    this.castRay(_o, _d, d.range);
    _p.copy(HIT.point);
    // 2) bullet ray from the chest to that point (walls between player and target still block)
    const origin = _o2.set(p.position.x, p.position.y + 1.35, p.position.z);
    _d2.copy(_p).sub(origin);
    const len = _d2.length();
    if (len < 0.5) _d2.copy(_d); else _d2.multiplyScalar(1 / len);
    this.castRay(origin, _d2, d.range);
    const kind = HIT.kind, target = HIT.target, dist = HIT.dist;
    const end = HIT.point.clone();
    if (kind === 'ped') g.peds.damage?.(target, d.damage, 'player');
    else if (kind === 'vehicle') g.vehicles.damage?.(target, d.vehDmg ?? d.damage * 0.4);
    if (kind) this.spark(end, kind === 'ped' ? 7 : kind === 'ground' ? 4 : 10, kind === 'ped' ? 0xff4a3a : 0xffc860);
    void dist;

    // visuals
    const muzzle = new THREE.Vector3();
    p.character.root.updateMatrixWorld(true);
    p.character.muzzleObject.getWorldPosition(muzzle);
    this.flash.visible = true; this.flashT = 0.05; this.flash.position.copy(muzzle);
    this.flash.lookAt(muzzle.x + _d2.x, muzzle.y + _d2.y, muzzle.z + _d2.z);
    this.flash.rotation.z = Math.random() * 6;
    this.tracer(muzzle, end);
    g.audio?.play?.(d.sound, { x: p.position.x, z: p.position.z });
    g.events.emit('weapon:fired', { position: origin.clone(), weapon: d.id });

    // recoil + camera shake, bloom grows with sustained fire
    cam.kick(d.kick * (p.aimK > 0.5 ? 0.7 : 1));
    cam.shake(d.shake);
    this.bloom = Math.min(0.05, this.bloom + (d.spread || 0) * 0.25);
    if (this.current.clip <= 0 && this.current.ammo > 0) this.startReload();
  }

  tracer(a, b) {
    const t = this.tracers[this.tracerI++ % this.tracers.length];
    const len = Math.max(0.1, a.distanceTo(b));
    t.position.copy(a).lerp(b, 0.5); t.scale.set(1, 1, len); t.lookAt(b);
    t.visible = true; t.life = 0.07; t.material.opacity = 0.9;
  }

  spark(pt, n, color) {
    for (let i = 0; i < n; i++) {
      const s = this.sparks[this.sparkI++ % this.sparks.length];
      s.position.copy(pt); s.visible = true; s.life = 0.2 + Math.random() * 0.15;
      s.vel.set((Math.random() - 0.5) * 5, Math.random() * 4 + 1, (Math.random() - 0.5) * 5);
      s.material.color.setHex(color); s.material.opacity = 1;
    }
  }
}

function rayCircle(ox, oz, dx, dz, cx, cz, r) {
  const fx = cx - ox, fz = cz - oz;
  const tca = fx * dx + fz * dz;
  if (tca < 0) return Infinity;
  const d2 = fx * fx + fz * fz - tca * tca;
  if (d2 > r * r) return Infinity;
  return tca - Math.sqrt(r * r - d2);
}
