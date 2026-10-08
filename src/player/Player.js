import * as THREE from 'three';
import { CITY } from '../core/config.js';
import { resolveCircleVsBoxes } from '../core/physics.js';
import { Character } from './Character.js';
import { Weapons } from './Weapons.js';
import { CameraRig, lerpAngle } from './CameraRig.js';

const AIM_SLOW = 0.55, STRIDE = 2.3; // aim-mode speed factor; metres per footstep (matches the walk-cycle phase)
const WALK = 4.4, RUN = 8.2, GRAVITY = 24, JUMP_V = 8, ENTER_RANGE = 4;
// Sign convention for vehicle.setControls({steer}): +1 = steer RIGHT (D key), see ARCHITECTURE.md.
const STEER_LEFT = -1;
const DIGITS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7']; // fists, pistol, SMG, shotgun, rifle, sniper, grenade

export class Player {
  constructor(game) {
    this.game = game;
    this.position = new THREE.Vector3(0, 0, 0);
    this.heading = 0;
    this.radius = 0.4;
    this.health = 100; this.armor = 0; this.alive = true;
    this.vehicle = null;
    this.vy = 0; this.grounded = true;
    this.vel = new THREE.Vector3();
    this.state = 'alive';      // 'alive' | 'dead' | 'busted'
    this.stateT = 0;
    this.spawned = false;
    this.lastHorn = 0;
    this.aimK = 0; this.scopeK = 0; this.stepDist = 0; this.hspeed = 0;

    this.character = new Character();
    this.mesh = this.character.root;
    game.scene.add(this.mesh);
    this.weapons = new Weapons(game, this);
    this.weapon = this.weapons.current;
    this.weapons.select(1);
    this.cam = new CameraRig(game);
    this.near = []; this.nearAt = new THREE.Vector3(1e9, 0, 1e9); this.nearCount = -1;

    game.events.on('player:busted', () => this.busted());
    game.events.on('player:damaged', e => { if (e?.source === 'explosion') this.cam.shake(0.7); else this.cam.shake(0.15); });
    game.events.on('vehicle:crash', e => {
      if (!this.alive || !this.vehicle || e?.vehicle !== this.vehicle) return;
      const imp = Math.abs(e.impact || 0);
      if (imp > 4) this.cam.shake(Math.min(0.9, imp / 22));
      if (imp > 9) this.damage(Math.min(45, (imp - 9) * 1.8), 'crash');
    });
    game.events.on('vehicle:destroyed', e => {
      if (this.vehicle && e?.vehicle === this.vehicle) { this.exitVehicle(true); this.damage(55, 'explosion'); }
    });
  }

  // ---------- public API ----------
  damage(amount, source) {
    if (!this.alive || amount <= 0) return;
    if (this.armor > 0) {
      const ab = Math.min(this.armor, amount * 0.7);
      this.armor -= ab; amount -= ab;
    }
    this.health = Math.max(0, this.health - amount);
    this.game.events.emit('player:damaged', { amount, source });
    if (this.health <= 0) this.die(source);
  }
  heal(n) { if (this.alive) this.health = Math.min(100, this.health + n); }
  addArmor(n) { this.armor = Math.min(100, this.armor + n); }
  addAmmo(id, n) { this.weapons.addAmmo(id, n); }
  // Crosshair info for the HUD: aim mode on, current weapon and spread (radians).
  getAimInfo() {
    const gun = !this.vehicle && this.alive && !this.weapons.def.melee;
    return { aiming: gun && this.aimK > 0.5, weaponId: this.weapons.def.id, spread: this.weapons.spread(gun && this.aimK > 0.5) };
  }
  teleport(x, z) { this.position.set(x, 0, z); this.vy = 0; this.vel.set(0, 0, 0); }

  // ---------- life cycle ----------
  die(source) {
    if (this.state !== 'alive') return;
    const g = this.game;
    if (this.vehicle) this.exitVehicle(true);
    this.alive = false; this.state = 'dead'; this.stateT = 0;
    this.health = 0;
    g.events.emit('player:died', { source, position: this.position.clone() });
    g.events.emit('hud:bigtext', { text: 'WASTED', color: '#c00', duration: 3.5 });
    g.audio?.play?.('wasted');
  }

  busted() {
    if (this.state !== 'alive') return;
    if (this.vehicle) this.exitVehicle(true);
    this.alive = false; this.state = 'busted'; this.stateT = 0;
    this.vel.set(0, 0, 0);
  }

  respawn() {
    const g = this.game;
    const type = this.state === 'busted' ? 'police' : 'hospital';
    const pois = (g.world?.pois || []).filter(p => p.type === type);
    let best = null, bd = Infinity;
    for (const p of pois) { const d = (p.x - this.position.x) ** 2 + (p.z - this.position.z) ** 2; if (d < bd) { bd = d; best = p; } }
    const sp = best || g.world?.getSpawnPoint?.() || { x: 0, z: 0 };
    const loss = Math.floor((g.state.money || 0) * 0.1);
    if (loss > 0) { g.state.money -= loss; g.events.emit('money:changed', { money: g.state.money, delta: -loss }); }
    this.position.set(sp.x, 0, sp.z); this.vy = 0; this.vel.set(0, 0, 0); this.grounded = true;
    this.health = 100; this.armor = 0; this.alive = true; this.state = 'alive';
    this.character.update(0, { dying: 0 });
    this.cam.snap(this.heading);
    g.events.emit('player:respawn', { position: this.position.clone() });
  }

  // ---------- vehicles ----------
  tryEnterVehicle() {
    const vm = this.game.vehicles;
    const v = vm?.getNearest?.(this.position.x, this.position.z, ENTER_RANGE, c => !c.destroyed);
    if (!v || v.destroyed) return;
    vm.enter?.(v, 'player');
    this.vehicle = v; this.mesh.visible = false;
    this.position.set(v.position.x, 0, v.position.z);
    this.vel.set(0, 0, 0); this.vy = 0;
  }
  exitVehicle(force = false) {
    const v = this.vehicle; if (!v) return;
    try { v.setControls?.({ throttle: 0, steer: 0, brake: 0, handbrake: 1 }); } catch (e) { /* stub */ }
    let p = null;
    try { p = this.game.vehicles?.exit?.(v); } catch (e) { /* stub */ }
    this.vehicle = null; this.mesh.visible = true;
    if (p && Number.isFinite(p.x)) this.position.set(p.x, 0, p.z);
    else {
      const h = v.heading || 0; // fallback: left of the car
      this.position.set(v.position.x + Math.cos(h) * ((v.radius || 2) + 1), 0, v.position.z - Math.sin(h) * ((v.radius || 2) + 1));
    }
    this.vy = 0; this.vel.set(0, 0, 0); this.heading = v.heading || this.heading;
    void force;
  }

  drive(dt) {
    const inp = this.game.input, v = this.vehicle;
    const fwd = inp.isDown('KeyW'), back = inp.isDown('KeyS');
    const sp = v.speed || 0;
    let throttle = 0, brake = 0;
    if (fwd && !back) { if (sp < -1) brake = 1; else throttle = 1; }
    else if (back && !fwd) { if (sp > 1) brake = 1; else throttle = -1; }
    const steer = ((inp.isDown('KeyA') ? 1 : 0) - (inp.isDown('KeyD') ? 1 : 0)) * STEER_LEFT;
    v.setControls?.({ throttle, steer, brake, handbrake: inp.isDown('Space') ? 1 : 0 });
    if (inp.pressed('KeyH') || (inp.isDown('KeyH') && this.game.time - this.lastHorn > 0.45)) {
      this.lastHorn = this.game.time; this.game.audio?.play?.('horn', { x: v.position.x, z: v.position.z });
    }
    this.position.set(v.position.x, 0, v.position.z);
    this.heading = v.heading || 0;
    this.mesh.position.copy(this.position);
  }

  // ---------- on foot ----------
  refreshNear(range = 45) {
    const cols = this.game.world?.colliders;
    if (!cols) { this.near = []; return; }
    const p = this.position;
    if (cols.length === this.nearCount && (p.x - this.nearAt.x) ** 2 + (p.z - this.nearAt.z) ** 2 < 100) return;
    this.nearCount = cols.length; this.nearAt.copy(p);
    this.near = cols.filter(b => p.x > b.minX - range && p.x < b.maxX + range && p.z > b.minZ - range && p.z < b.maxZ + range);
  }

  // Push the player out of every car (capsule along the car's length). Parked cars included.
  collideVehicles() {
    const list = this.game.vehicles?.list; if (!list) return;
    const pos = this.position, r = this.radius;
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      if (!v || !v.position || v === this.vehicle || v.driver === 'player') continue;
      const vx = v.position.x, vz = v.position.z, reach = (v.radius || 2) + 2.5 + r;
      if (Math.abs(pos.x - vx) > reach || Math.abs(pos.z - vz) > reach) continue;
      const cr = v.cr || 0.9, off = v.coff ?? 0.9, h = v.heading || 0, fx = Math.sin(h), fz = Math.cos(h);
      // capsule: closest point on the car's centre line (-off..+off), radius cr
      const t = Math.max(-off, Math.min(off, (pos.x - vx) * fx + (pos.z - vz) * fz));
      const cx = vx + fx * t, cz = vz + fz * t;
      const dx = pos.x - cx, dz = pos.z - cz, rr = cr + r, d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2);
      if (d > 1e-5) { pos.x += dx / d * (rr - d); pos.z += dz / d * (rr - d); }
      else { pos.x += -fz * rr; pos.z += fx * rr; } // exactly on the centre line: push sideways
    }
  }

  walk(dt, aiming = false) {
    const g = this.game, inp = g.input, cam = this.cam;
    let ix = (inp.isDown('KeyD') ? 1 : 0) - (inp.isDown('KeyA') ? 1 : 0);
    let iz = (inp.isDown('KeyW') ? 1 : 0) - (inp.isDown('KeyS') ? 1 : 0);
    const len = Math.hypot(ix, iz);
    const sprint = !aiming && (inp.isDown('ShiftLeft') || inp.isDown('ShiftRight'));
    const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
    let wx = 0, wz = 0;
    if (len > 0) {
      ix /= len; iz /= len;
      // forward = (sin, cos); right = (-cos, sin)
      wx = sy * iz - cy * ix; wz = cy * iz + sy * ix;
    }
    const speed = len > 0 ? (sprint ? RUN : WALK) * (aiming ? AIM_SLOW : 1) : 0;
    const k = 1 - Math.exp(-dt * (this.grounded ? 14 : 3));
    this.vel.x += (wx * speed - this.vel.x) * k;
    this.vel.z += (wz * speed - this.vel.z) * k;

    if (this.grounded && inp.pressed('Space')) { this.vy = JUMP_V; this.grounded = false; }
    // ground height: flat in the city, beach slope and pier decks via world.groundAt (T3), 0 otherwise
    const world = g.world, gy = world?.groundAt?.(this.position.x, this.position.z) ?? 0;
    if (this.grounded && this.vy <= 0 && this.position.y - gy < 0.4) { this.position.y = gy; this.vy = 0; }
    else {
      this.vy -= GRAVITY * dt;
      this.position.y += this.vy * dt;
      if (this.position.y <= gy) { this.position.y = gy; this.vy = 0; this.grounded = true; }
    }

    const px = this.position.x, pz = this.position.z;
    this.position.x += this.vel.x * dt; this.position.z += this.vel.z * dt;
    this.refreshNear();
    if (this.near.length) resolveCircleVsBoxes(this.position, this.radius, this.near);
    if (this.position.y < 1.2) { this.collideVehicles(); if (this.near.length) resolveCircleVsBoxes(this.position, this.radius, this.near); }
    if (world?.isWalkable) { // land, beach, pier and quay; deep water is blocked (slide along the edge)
      if (!world.isWalkable(this.position.x, this.position.z)) {
        if (world.isWalkable(this.position.x, pz)) { this.position.z = pz; this.vel.z = 0; }
        else if (world.isWalkable(px, this.position.z)) { this.position.x = px; this.vel.x = 0; }
        else { this.position.x = px; this.position.z = pz; this.vel.x = this.vel.z = 0; }
      }
    } else {
      const lim = world?.playLimit ?? CITY.half - 1;
      this.position.x = Math.max(-lim, Math.min(lim, this.position.x));
      this.position.z = Math.max(-lim, Math.min(lim, this.position.z));
    }

    // facing
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.hspeed = hs;
    // footsteps: one per stride while moving on the ground
    if (this.grounded && hs > 0.8) {
      this.stepDist += hs * dt;
      if (this.stepDist >= STRIDE) { this.stepDist -= STRIDE; g.audio?.play?.('footstep', { x: this.position.x, z: this.position.z }); }
    } else if (hs <= 0.8) this.stepDist = STRIDE * 0.5;
    return { moving: len > 0, hs };
  }

  update(dt) {
    const g = this.game, inp = g.input;
    if (!this.spawned) {
      this.spawned = true;
      const sp = g.world?.getSpawnPoint?.() || { x: 0, z: 0 };
      this.position.set(sp.x, 0, sp.z);
      this.cam.snap(0);
    }
    this.refreshNear();
    this.weapons.updateFx(dt);
    const wheelOpen = !!g.weaponWheel?.open, shopOpen = !!g.shop?.isOpen;

    if (this.state !== 'alive') {
      this.stateT += dt;
      if (this.state === 'dead') this.character.update(dt, { dying: Math.min(1, this.stateT / 0.7) + 0.0001 });
      else this.character.update(dt, { speed: 0, grounded: true });
      this.mesh.position.copy(this.position);
      this.mesh.visible = true; this.scopeK = 0;
      this.cam.update(dt, this.position, { colliders: this.near });
      if (this.stateT > (this.state === 'dead' ? 4 : 3)) this.respawn();
      return;
    }

    // weapon switching
    if (!this.vehicle && !wheelOpen && !shopOpen) {
      if (inp.pressed('KeyQ')) this.weapons.cycle(-1);
      if (inp.pressed('KeyE')) this.weapons.cycle(1);
      for (let i = 0; i < DIGITS.length; i++) if (inp.pressed(DIGITS[i])) this.weapons.select(i);
      const wh = inp.mouse.wheel;
      if (wh) this.weapons.cycle(wh > 0 ? 1 : -1);
      if (inp.pressed('KeyR')) this.weapons.startReload();
    }
    if (shopOpen) { // buying: the player stands still, the shop menu owns the keys
      this.vel.set(0, 0, 0); this.aimK = 0; this.scopeK = 0; this.mesh.visible = true;
      this.character.update(dt, { speed: 0, grounded: this.grounded, reload: -1 });
      this.cam.update(dt, this.position, { colliders: this.near, freeze: true });
      return;
    }
    if (inp.pressed('KeyF')) { if (this.vehicle) this.exitVehicle(); else this.tryEnterVehicle(); }

    if (this.vehicle) {
      if (this.vehicle.destroyed) this.exitVehicle(true);
      else {
        this.drive(dt);
        this.weapons.update(dt, false, false, this.cam.yaw);
        this.aimK = 0; this.scopeK = 0;
        this.cam.update(dt, this.position, { vehicle: this.vehicle, colliders: this.near });
        return;
      }
    }

    const m = inp.mouse;
    const gunOut = !this.weapons.def.melee;
    const aiming = gunOut && m.right && !wheelOpen;
    this.aimK += ((aiming ? 1 : 0) - this.aimK) * (1 - Math.exp(-dt * 12));
    // sniper rifle: right mouse button zooms through the scope (the body is hidden while fully scoped)
    const scoping = aiming && !!this.weapons.def.scope;
    this.scopeK += ((scoping ? 1 : 0) - this.scopeK) * (1 - Math.exp(-dt * 9));
    this.mesh.visible = this.scopeK < 0.85;
    const mv = this.walk(dt, aiming);
    const fireHeld = !wheelOpen && ((m.locked && m.left) || inp.isDown('ControlLeft') || inp.isDown('ControlRight'));
    const firePressed = !wheelOpen && ((m.locked && m.leftPressed) || inp.pressed('ControlLeft') || inp.pressed('ControlRight'));
    const fired = this.weapons.update(dt, fireHeld, firePressed, this.cam.yaw);
    if (fired && gunOut) this.aimT = 1.6;
    if (fired && !gunOut) this.aimT = 0.4;
    this.aimT = Math.max(0, (this.aimT || 0) - dt);

    // heading: face aim direction while shooting/punching, otherwise movement direction
    if (this.aimT > 0 || aiming) this.heading = lerpAngle(this.heading, this.cam.yaw, 1 - Math.exp(-dt * 18));
    else if (mv.hs > 0.5) this.heading = lerpAngle(this.heading, Math.atan2(this.vel.x, this.vel.z), 1 - Math.exp(-dt * 12));

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.heading;
    this.character.update(dt, { speed: mv.hs, grounded: this.grounded, aiming: gunOut && (this.aimT > 0 || aiming), vy: this.vy, reload: this.weapons.reloadProgress, pitch: Math.asin(Math.max(-1, Math.min(1, this.cam.aimDir.y))) });
    this.cam.update(dt, this.position, { colliders: this.near, aim: this.aimK, scope: this.scopeK, freeze: wheelOpen });
  }
}
