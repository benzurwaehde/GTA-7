import * as THREE from 'three';
import { rayBox } from '../core/physics.js';
import { getModel } from '../core/assets.js';
import { Impacts } from './Impacts.js';
import { Grenades } from './Grenades.js';

// Weapon table. `ammo` = total rounds when the weapon is acquired (clip + reserve), `maxReserve` caps the reserve.
// `own: true` = the player starts with it, everything else is bought at Bullseye Arms (src/shop).
// `flash` = muzzle flash size / colour, `pellets` = shotgun pellets per shot, `scope` = sniper zoom, `thrown` = grenade.
export const WEAPON_DEFS = [
  { id: 'fists', name: 'Fists', melee: true, own: true, damage: 18, rate: 0.42, range: 1.9, ammo: Infinity, auto: false },
  { id: 'pistol', name: 'Pistol', own: true, damage: 26, rate: 0.28, range: 90, ammo: 48, maxReserve: 150, clipSize: 12, reload: 1.3, auto: false, spread: 0.012, sound: 'gunshot', vehDmg: 10, kick: 0.016, shake: 0.12, flash: { s: 1, c: 0xffd27a } },
  { id: 'smg', name: 'SMG', damage: 11, rate: 0.085, range: 80, ammo: 150, maxReserve: 300, clipSize: 30, reload: 1.9, auto: true, spread: 0.03, sound: 'smg', vehDmg: 4, kick: 0.009, shake: 0.08, flash: { s: 0.8, c: 0xffe08a } },
  { id: 'shotgun', name: 'Shotgun', damage: 15, pellets: 8, pelletSpread: 0.05, falloff: 8, rate: 0.85, range: 40, ammo: 30, maxReserve: 60, clipSize: 6, reload: 2.3, auto: false, spread: 0.01, sound: 'shotgun', vehDmg: 4, kick: 0.055, shake: 0.42, flash: { s: 1.9, c: 0xffb04a } },
  { id: 'rifle', name: 'Assault Rifle', damage: 20, rate: 0.095, range: 140, ammo: 120, maxReserve: 240, clipSize: 30, reload: 2.1, auto: true, spread: 0.011, sound: 'rifle', vehDmg: 6, kick: 0.012, shake: 0.12, flash: { s: 1.15, c: 0xffd890 } },
  { id: 'sniper', name: 'Sniper Rifle', damage: 250, rate: 1.15, range: 320, ammo: 15, maxReserve: 30, clipSize: 5, reload: 2.7, auto: false, spread: 0.045, scope: true, sound: 'sniper', vehDmg: 45, kick: 0.06, shake: 0.4, flash: { s: 1.6, c: 0xffe6b0 } },
  { id: 'grenade', name: 'Grenade', thrown: true, damage: 0, rate: 0.9, range: 0, ammo: 5, maxReserve: 12, clipSize: 1, reload: 0.9, auto: false, spread: 0, sound: 'grenade', kick: 0.01, shake: 0.05 },
];

const HOLD_SCALE = 1.45;
const LONG = new Set(['smg', 'shotgun', 'rifle', 'sniper']);
const _v = new THREE.Vector3();
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _o2 = new THREE.Vector3(), _d2 = new THREE.Vector3();
const _end = new THREE.Vector3(), _muzzle = new THREE.Vector3(), _vel = new THREE.Vector3(), _punchO = new THREE.Vector3(), _punchD = new THREE.Vector3();
// reusable result of castRay (no per-shot allocations); n* = surface normal at the hit point
const HIT = { dist: 0, kind: null, target: null, point: new THREE.Vector3(), nx: 0, ny: 1, nz: 0 };

// Weapon inventory + hitscan + visual effects (muzzle flash, tracers, sparks, bullet holes, grenades, scope).
export class Weapons {
  constructor(game, player) {
    this.game = game; this.player = player;
    // ammo = reserve; clip = rounds in the magazine
    this.states = WEAPON_DEFS.map(d => d.melee
      ? { id: d.id, name: d.name, ammo: d.ammo, clip: Infinity, clipSize: Infinity, reloading: false, owned: true }
      : d.own
        ? { id: d.id, name: d.name, ammo: d.ammo - d.clipSize, clip: d.clipSize, clipSize: d.clipSize, reloading: false, owned: true }
        : { id: d.id, name: d.name, ammo: 0, clip: 0, clipSize: d.clipSize, reloading: false, owned: false });
    this.reloadT = 0; this.bloom = 0;
    this.index = 1;
    this.cooldown = 0;
    this.noAmmoMsg = 0;

    const g = this.fx = new THREE.Group(); g.name = 'weaponFx'; game.scene.add(g);
    // muzzle flash: two crossed additive planes + a cone (size and colour are set per weapon)
    const fm = this.flashMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.flash = new THREE.Group();
    for (const r of [0, Math.PI / 2]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), fm); p.rotation.z = r; this.flash.add(p); }
    const cone = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.55), fm); cone.rotation.y = Math.PI / 2; cone.position.z = 0.2; this.flash.add(cone);
    this.flash.visible = false; this.flashT = 0; g.add(this.flash);
    // tracers
    this.tracers = [];
    const tm = new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.9, depthWrite: false });
    const tg = new THREE.BoxGeometry(0.025, 0.025, 1);
    for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(tg, tm.clone()); m.visible = false; m.life = 0; g.add(m); this.tracers.push(m); }
    this.tracerI = 0;
    // sparks / dust chips
    this.sparks = [];
    const sg = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    for (let i = 0; i < 64; i++) {
      const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true }));
      m.visible = false; m.life = 0; m.vel = new THREE.Vector3(); g.add(m); this.sparks.push(m);
    }
    this.sparkI = 0;

    this.impacts = new Impacts(game);
    this.grenades = new Grenades(game);
    this.buildModels();
    this.buildScope();
  }

  get current() { return this.states[this.index]; }
  get def() { return WEAPON_DEFS[this.index]; }
  stateOf(id) { return this.states.find(s => s.id === id); }
  defOf(id) { return WEAPON_DEFS.find(d => d.id === id); }

  // ---------- models in the hand ----------
  buildModels() {
    this.hold = new THREE.Group(); this.hold.name = 'weaponHold';
    this.hold.scale.setScalar(HOLD_SCALE); this.hold.position.set(0, 0, 0.03); // models are drawn a bit larger so they read at game camera distance
    this.models = {};
    for (const d of WEAPON_DEFS) {
      if (d.melee) continue;
      const m = getModel('weapon_' + d.id);
      if (!m) continue;
      m.visible = false; m.traverse(o => { if (o.isMesh) o.castShadow = true; });
      this.hold.add(m);
      this.models[d.id] = { obj: m, muzzle: m.getObjectByName('Muzzle') };
    }
  }
  // Mount the model group on the hand (T1's character.rightHand, else the old gun mount); returns false without a mount.
  attach() {
    const c = this.player.character;
    const parent = c?.rightHand || c?.gunMount || null;
    if (!parent) return false;
    if (this.hold.parent !== parent) parent.add(this.hold);
    return true;
  }
  refreshVisual() {
    const id = this.def.id, c = this.player.character;
    const mdl = this.models[id];
    for (const k in this.models) this.models[k].obj.visible = k === id && (id !== 'grenade' || this.current.clip > 0);
    this.heldMuzzle = mdl?.muzzle || null;
    // no model for this weapon (file missing / no hand): fall back to the character's own procedural gun
    const own = !mdl || !this.attach();
    c?.setWeapon?.(own && !this.def.melee ? id : null);
    // two-handed stance for long guns (T1: 'pistol' | 'rifle' | 'none')
    c?.setWeaponStyle?.(this.def.melee ? 'none' : LONG.has(id) ? 'rifle' : 'pistol');
  }
  // World position of the muzzle (model empty, else the character's muzzle object) -> out.
  muzzleWorld(out) {
    const m = this.heldMuzzle && this.hold.parent ? this.heldMuzzle : this.player.character.muzzleObject;
    (m || this.player.character.root).getWorldPosition(out);
    return out;
  }

  // ---------- inventory ----------
  select(i) {
    const n = this.states.length;
    const idx = ((i % n) + n) % n;
    if (!this.states[idx].owned) {
      this.game.events.emit('hud:message', { text: `${this.states[idx].name}: not owned (buy it at Bullseye Arms)`, duration: 2 });
      return false;
    }
    this.index = idx;
    this.cooldown = Math.max(this.cooldown, 0.15);
    for (const st of this.states) { st.reloading = false; }
    this.reloadT = 0;
    this.refreshVisual();
    this.player.weapon = this.current;
    this.game.events.emit('weapon:changed', { weapon: this.current });
    return true;
  }
  // next owned weapon in direction dir (+1 / -1)
  cycle(dir) {
    const n = this.states.length;
    for (let k = 1; k <= n; k++) {
      const idx = ((this.index + dir * k) % n + n) % n;
      if (this.states[idx].owned) return this.select(idx);
    }
    return false;
  }
  // Add reserve rounds (capped by maxReserve). Unowned weapons get nothing. Returns the number added.
  addAmmo(id, n) {
    const s = this.stateOf(id), d = this.defOf(id);
    if (!s || !s.owned || !Number.isFinite(s.ammo)) return 0;
    const add = Math.max(0, Math.min(n, (d.maxReserve ?? 9999) - s.ammo));
    s.ammo += add; return add;
  }
  // Acquire a weapon (shop): owned + full starting ammo (clip + reserve). A grenade purchase adds `ammoTotal` instead.
  give(id, ammoTotal) {
    const s = this.stateOf(id), d = this.defOf(id);
    if (!s || !d) return false;
    const wasOwned = s.owned;
    s.owned = true;
    const total = ammoTotal ?? d.ammo;
    if (!wasOwned) { s.clip = Math.min(d.clipSize, total); s.ammo = Math.max(0, total - s.clip); }
    else this.addAmmo(id, total);
    return true;
  }

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

  // Nearest hit along a 3D ray (unit dir): walls (height-aware), peds, vehicles, ground. Fills and returns HIT (incl. surface normal).
  castRay(o, d, maxDist) {
    const g = this.game, p = this.player;
    let dist = maxDist, kind = null, target = null, wall = null;
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
      dist = t; kind = 'wall'; wall = b;
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
    // police helicopter (T4): sphere test, damage is applied by the caller
    const heli = g.police?.helicopter;
    if (heli && !heli.dead && heli.rayHit) {
      const t = heli.rayHit(o, d, dist);
      if (t < dist) { dist = t; kind = 'heli'; target = heli; }
    }
    if (d.y < -1e-4) { const tg = -o.y / d.y; if (tg > 0 && tg < dist) { dist = tg; kind = 'ground'; target = null; } }
    HIT.dist = dist; HIT.kind = kind; HIT.target = target;
    HIT.point.copy(o).addScaledVector(d, dist);
    // surface normal: ground = up, wall = face of the box nearest to the hit point, otherwise against the ray
    if (kind === 'ground') { HIT.nx = 0; HIT.ny = 1; HIT.nz = 0; }
    else if (kind === 'wall') {
      const x = HIT.point.x, z = HIT.point.z;
      const a = Math.abs(x - wall.minX), b = Math.abs(x - wall.maxX), c = Math.abs(z - wall.minZ), e = Math.abs(z - wall.maxZ);
      const m = Math.min(a, b, c, e);
      HIT.ny = 0; HIT.nx = HIT.nz = 0;
      if (m === a) HIT.nx = -1; else if (m === b) HIT.nx = 1; else if (m === c) HIT.nz = -1; else HIT.nz = 1;
    } else { HIT.nx = -d.x; HIT.ny = -d.y; HIT.nz = -d.z; }
    return HIT;
  }

  // Per-frame effects (called by the player every frame, also while dead / driving).
  updateFx(dt) {
    this.attach();
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flash.visible = false; }
    for (const t of this.tracers) if (t.life > 0) { t.life -= dt; t.material.opacity = Math.max(0, t.life / 0.07) * 0.9; if (t.life <= 0) t.visible = false; }
    for (const s of this.sparks) if (s.life > 0) {
      s.life -= dt; s.vel.y -= 14 * dt; s.position.addScaledVector(s.vel, dt);
      s.material.opacity = Math.max(0, s.life / 0.35); if (s.life <= 0 || s.position.y < 0) { s.visible = false; s.life = 0; }
    }
    if (this.flash.visible) this.muzzleWorld(this.flash.position);
    this.impacts.update(dt);
    this.grenades.update(dt);
    // a grenade in the hand only shows while there is one in the clip
    const gm = this.models.grenade;
    if (gm) gm.obj.visible = this.def.id === 'grenade' && this.current.clip > 0;
    this.updateScope();
  }

  update(dt, wantFire, firePressed, aimYaw) {
    this.cooldown -= dt;
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
    if (d.melee) this.punch(d, aimYaw);
    else if (d.thrown) this.throwGrenade(d);
    else this.shoot(d);
    return true;
  }

  punch(d, yaw) {
    const p = this.player, g = this.game;
    p.character.punch();
    g.audio?.play?.('punch', { x: p.position.x, z: p.position.z });
    const origin = _punchO.set(p.position.x, p.position.y + 1.2, p.position.z);
    const dir = _punchD.set(Math.sin(yaw), 0, Math.cos(yaw));
    const hit = g.peds?.hitTest?.(origin, dir, d.range);
    if (hit?.ped) {
      g.peds.damage?.(hit.ped, d.damage, 'player');
      g.audio?.play?.('hit', { x: hit.point?.x ?? p.position.x, z: hit.point?.z ?? p.position.z });
      if (hit.point) this.spark(hit.point, 6, 0xff6a5a);
    }
  }

  // Current spread (radians) for the crosshair: base + recent-fire bloom, tighter when aiming, near zero when scoped.
  spread(aiming) {
    const d = this.def;
    if (d.scope && this.player.scopeK > 0.8) return 0.0015;
    return (d.spread || 0) * (aiming ? 0.45 : 1) + this.bloom;
  }

  throwGrenade(d) {
    const p = this.player, cam = p.cam;
    this.current.clip--;
    p.character.punch?.();
    // from the chest, slightly forward, along the camera ray with a lob
    _o.set(p.position.x, p.position.y + 1.5, p.position.z).addScaledVector(cam.aimDir, 0.5);
    _vel.copy(cam.aimDir); _vel.y += 0.3; _vel.normalize().multiplyScalar(15);
    _vel.x += p.vel.x * 0.5; _vel.z += p.vel.z * 0.5;
    this.grenades.throw(_o, _vel);
    this.game.audio?.play?.(d.sound, { x: p.position.x, z: p.position.z });
    this.game.events.emit('weapon:fired', { position: _o.clone(), weapon: d.id });
    cam.kick(d.kick);
    if (this.current.clip <= 0 && this.current.ammo > 0) this.startReload();
  }

  shoot(d) {
    const p = this.player, g = this.game, cam = p.cam;
    this.current.clip--;
    const aiming = p.aimK > 0.5;
    const sp = this.spread(aiming);
    const n = d.pellets || 1;
    const origin = _o2.set(p.position.x, p.position.y + 1.35, p.position.z);
    p.character.root.updateMatrixWorld(true);
    this.muzzleWorld(_muzzle);
    let last = null;
    for (let k = 0; k < n; k++) {
      // 1) camera ray through the screen centre (+ spread) finds the aim point under the crosshair
      const ps = k === 0 && n > 1 ? 0 : (d.pelletSpread || 0);
      _d.copy(cam.aimDir);
      _d.x += (Math.random() - 0.5) * 2 * (sp + ps); _d.y += (Math.random() - 0.5) * 2 * (sp + ps); _d.z += (Math.random() - 0.5) * 2 * (sp + ps);
      _d.normalize();
      const skip = cam.curDist || 0; // ignore everything between camera and player
      _o.copy(cam.aimOrigin).addScaledVector(_d, skip);
      this.castRay(_o, _d, d.range);
      _p.copy(HIT.point);
      // 2) bullet ray from the chest to that point (walls between player and target still block)
      _d2.copy(_p).sub(origin);
      const len = _d2.length();
      if (len < 0.5) _d2.copy(_d); else _d2.multiplyScalar(1 / len);
      this.castRay(origin, _d2, d.range);
      const kind = HIT.kind, target = HIT.target, dist = HIT.dist;
      _end.copy(HIT.point);
      // shotgun pellets lose damage with distance
      const fall = d.falloff ? 1 - Math.min(1, Math.max(0, (dist - d.falloff) / (d.range - d.falloff))) * 0.85 : 1;
      if (kind === 'ped') g.peds.damage?.(target, d.damage * fall, 'player');
      else if (kind === 'vehicle') g.vehicles.damage?.(target, (d.vehDmg ?? d.damage * 0.4) * fall);
      else if (kind === 'heli') { if (!target.hitRay?.(origin, _d2, d.range, d.damage * 0.5 * fall)) target.hit?.(_end, d.damage * 0.5 * fall); }
      this.impact(kind);
      this.tracer(_muzzle, _end);
      last = _d2;
    }
    // visuals: muzzle flash sized / coloured per weapon
    const fl = d.flash || { s: 1, c: 0xffd27a };
    this.flashMat.color.setHex(fl.c);
    this.flash.scale.setScalar(fl.s);
    this.flash.visible = true; this.flashT = 0.05; this.flash.position.copy(_muzzle);
    this.flash.lookAt(_muzzle.x + last.x, _muzzle.y + last.y, _muzzle.z + last.z);
    this.flash.rotation.z = Math.random() * 6;
    g.audio?.play?.(d.sound, { x: p.position.x, z: p.position.z });
    g.events.emit('weapon:fired', { position: origin.clone(), weapon: d.id });

    // recoil + camera shake, bloom grows with sustained fire
    cam.kick(d.kick * (aiming ? 0.7 : 1));
    cam.shake(d.shake);
    this.bloom = Math.min(0.05, this.bloom + (d.spread || 0) * 0.25);
    if (this.current.clip <= 0 && this.current.ammo > 0) this.startReload();
  }

  // Sparks + bullet hole for the surface the last castRay hit (HIT).
  impact(kind) {
    if (!kind) return;
    const pt = HIT.point;
    if (kind === 'wall') { this.spark(pt, 5, 0xffc860); this.spark(pt, 3, 0x9a9a9a); this.impacts.add(pt.x, pt.y, pt.z, HIT.nx, HIT.ny, HIT.nz, 0.22); }
    else if (kind === 'ground') { this.spark(pt, 3, 0x8a7a66); this.impacts.add(pt.x, pt.y, pt.z, 0, 1, 0, 0.18); }
    else if (kind === 'vehicle' || kind === 'heli') this.spark(pt, 6, 0xffc860);
    else if (kind === 'ped') this.spark(pt, 5, 0xff4a3a);
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

  // ---------- sniper scope overlay (DOM) ----------
  buildScope() {
    const css = document.createElement('style');
    css.textContent = `.ws-scope{position:fixed;inset:0;pointer-events:none;opacity:0;visibility:hidden;z-index:4;
      background:radial-gradient(circle at 50% 50%,transparent 0,transparent min(34vh,34vw),#000 calc(min(34vh,34vw) + 2px));}
      .ws-scope:before,.ws-scope:after{content:"";position:absolute;background:#000;opacity:.85}
      .ws-scope:before{left:0;right:0;top:50%;height:2px;transform:translateY(-1px);margin:0 calc(50% - min(34vh,34vw))}
      .ws-scope:after{top:0;bottom:0;left:50%;width:2px;transform:translateX(-1px);margin:calc(50vh - min(34vh,34vw)) 0}
      .ws-scope i{position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px;border-radius:50%;background:#f33;box-shadow:0 0 6px #f33}
      .ws-scope b{position:absolute;left:50%;top:50%;width:min(68vh,68vw);height:min(68vh,68vw);margin:calc(min(34vh,34vw) * -1) 0 0 calc(min(34vh,34vw) * -1);border-radius:50%;box-shadow:inset 0 0 40px 8px rgba(0,0,0,.65)}`;
    document.head.appendChild(css);
    const el = this.scopeEl = document.createElement('div'); el.className = 'ws-scope';
    el.innerHTML = '<b></b><i></i>';
    this.game.ui.appendChild(el);
    this._scopeShown = -1;
  }
  updateScope() {
    const k = this.def.scope ? this.player.scopeK || 0 : 0;
    if (Math.abs(k - this._scopeShown) < 0.01) return;
    this._scopeShown = k;
    this.scopeEl.style.visibility = k > 0.55 ? 'visible' : 'hidden';
    this.scopeEl.style.opacity = String(Math.min(1, Math.max(0, (k - 0.55) / 0.35)));
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
