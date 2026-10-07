import * as THREE from 'three';
import { rayBox } from '../core/physics.js';

export const WEAPON_DEFS = [
  { id: 'fists', name: 'Fists', melee: true, damage: 18, rate: 0.42, range: 1.9, ammo: Infinity, auto: false },
  { id: 'pistol', name: 'Pistol', damage: 26, rate: 0.28, range: 90, ammo: 48, auto: false, spread: 0.012, sound: 'gunshot', vehDmg: 10 },
  { id: 'smg', name: 'SMG', damage: 11, rate: 0.085, range: 80, ammo: 150, auto: true, spread: 0.04, sound: 'smg', vehDmg: 4 },
];

const _v = new THREE.Vector3();

// Weapon inventory + hitscan + visual effects (muzzle flash, tracers, sparks).
export class Weapons {
  constructor(game, player) {
    this.game = game; this.player = player;
    this.states = WEAPON_DEFS.map(d => ({ id: d.id, name: d.name, ammo: d.ammo }));
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
    this.player.character.setWeapon(this.def.melee ? null : this.def.id);
    this.player.weapon = this.current;
    this.game.events.emit('weapon:changed', { weapon: this.current });
  }
  cycle(dir) { this.select(this.index + dir); }
  addAmmo(id, n) { const s = this.states.find(s => s.id === id); if (s && Number.isFinite(s.ammo)) s.ammo += n; }

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

    const d = this.def;
    const trigger = d.auto ? wantFire : firePressed;
    if (!trigger || this.cooldown > 0) return false;
    if (this.current.ammo <= 0) {
      if (firePressed && this.game.time - this.noAmmoMsg > 1) { this.noAmmoMsg = this.game.time; this.game.events.emit('hud:message', { text: `${d.name}: out of ammo`, duration: 1.5 }); }
      return false;
    }
    this.cooldown = d.rate;
    if (d.melee) this.punch(d, aimYaw); else this.shoot(d, aimYaw);
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

  shoot(d, yaw) {
    const p = this.player, g = this.game;
    this.current.ammo--;
    const origin = new THREE.Vector3(p.position.x, p.position.y + 1.35, p.position.z);
    const a = yaw + (Math.random() - 0.5) * 2 * (d.spread || 0);
    const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    // nearest of: wall, ped, vehicle
    let dist = d.range, kind = null, target = null, point = null;
    const colliders = g.world?.colliders;
    if (colliders) for (const b of colliders) {
      if (b.maxY !== undefined && b.maxY < 1.3) continue;
      const t = rayBox(origin.x, origin.z, dir.x, dir.z, b);
      if (t < dist) { dist = t; kind = 'wall'; }
    }
    const ph = g.peds?.hitTest?.(origin, dir, dist);
    if (ph && ph.ped && ph.dist <= dist) { dist = ph.dist; kind = 'ped'; target = ph.ped; point = ph.point; }
    const list = g.vehicles?.list;
    if (list) for (const v of list) {
      if (!v || v.destroyed || v === p.vehicle || !v.position) continue;
      const t = rayCircle(origin.x, origin.z, dir.x, dir.z, v.position.x, v.position.z, v.radius || 2);
      if (t < dist) { dist = t; kind = 'vehicle'; target = v; point = null; }
    }
    const end = point ? point.clone() : origin.clone().addScaledVector(dir, dist);
    if (kind === 'ped') g.peds.damage?.(target, d.damage, 'player');
    else if (kind === 'vehicle') g.vehicles.damage?.(target, d.vehDmg ?? d.damage * 0.4);
    if (kind) this.spark(end, kind === 'ped' ? 7 : 10, kind === 'ped' ? 0xff4a3a : 0xffc860);

    // visuals
    const muzzle = new THREE.Vector3();
    p.character.root.updateMatrixWorld(true);
    p.character.muzzleObject.getWorldPosition(muzzle);
    this.flash.visible = true; this.flashT = 0.05; this.flash.position.copy(muzzle);
    this.flash.lookAt(muzzle.x + dir.x, muzzle.y, muzzle.z + dir.z);
    this.flash.rotation.z = Math.random() * 6;
    this.tracer(muzzle, end.y === origin.y ? end.setY(muzzle.y) : end);
    g.audio?.play?.(d.sound, { x: p.position.x, z: p.position.z });
    g.events.emit('weapon:fired', { position: origin.clone(), weapon: d.id });
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
