import * as THREE from 'three';
import { CITY } from '../core/config.js';
import { resolveCircleVsBoxes } from '../core/physics.js';
import { Character } from './Character.js';
import { Weapons } from './Weapons.js';
import { CameraRig, lerpAngle } from './CameraRig.js';

const WALK = 4.4, RUN = 8.2, GRAVITY = 24, JUMP_V = 8, ENTER_RANGE = 4;
// Sign convention sent to vehicle.setControls({steer}): +1 = steer LEFT (A key). See company/requests/player.md.
const STEER_LEFT = 1;

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

    this.character = new Character();
    this.mesh = this.character.root;
    game.scene.add(this.mesh);
    this.weapons = new Weapons(game, this);
    this.weapon = this.weapons.current;
    this.weapons.select(1);
    this.cam = new CameraRig(game);
    this.near = []; this.nearAt = new THREE.Vector3(1e9, 0, 1e9); this.nearCount = -1;

    game.events.on('player:busted', () => this.busted());
    game.events.on('vehicle:crash', e => {
      if (!this.alive || !this.vehicle || e?.vehicle !== this.vehicle) return;
      const imp = Math.abs(e.impact || 0);
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

  walk(dt) {
    const g = this.game, inp = g.input, cam = this.cam;
    let ix = (inp.isDown('KeyD') ? 1 : 0) - (inp.isDown('KeyA') ? 1 : 0);
    let iz = (inp.isDown('KeyW') ? 1 : 0) - (inp.isDown('KeyS') ? 1 : 0);
    const len = Math.hypot(ix, iz);
    const sprint = inp.isDown('ShiftLeft') || inp.isDown('ShiftRight');
    const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
    let wx = 0, wz = 0;
    if (len > 0) {
      ix /= len; iz /= len;
      // forward = (sin, cos); right = (-cos, sin)
      wx = sy * iz - cy * ix; wz = cy * iz + sy * ix;
    }
    const speed = len > 0 ? (sprint ? RUN : WALK) : 0;
    const k = 1 - Math.exp(-dt * (this.grounded ? 14 : 3));
    this.vel.x += (wx * speed - this.vel.x) * k;
    this.vel.z += (wz * speed - this.vel.z) * k;

    if (this.grounded && inp.pressed('Space')) { this.vy = JUMP_V; this.grounded = false; }
    this.vy -= GRAVITY * dt;
    this.position.y += this.vy * dt;
    if (this.position.y <= 0) { this.position.y = 0; this.vy = 0; this.grounded = true; }

    this.position.x += this.vel.x * dt; this.position.z += this.vel.z * dt;
    this.refreshNear();
    if (this.near.length) resolveCircleVsBoxes(this.position, this.radius, this.near);
    const lim = CITY.half - 1;
    this.position.x = Math.max(-lim, Math.min(lim, this.position.x));
    this.position.z = Math.max(-lim, Math.min(lim, this.position.z));

    // facing
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.hspeed = hs;
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

    if (this.state !== 'alive') {
      this.stateT += dt;
      if (this.state === 'dead') this.character.update(dt, { dying: Math.min(1, this.stateT / 0.7) + 0.0001 });
      else this.character.update(dt, { speed: 0, grounded: true });
      this.mesh.position.copy(this.position);
      this.cam.update(dt, this.position, { colliders: this.near });
      if (this.stateT > (this.state === 'dead' ? 4 : 3)) this.respawn();
      return;
    }

    // weapon switching
    if (!this.vehicle) {
      if (inp.pressed('KeyQ')) this.weapons.cycle(-1);
      if (inp.pressed('KeyE')) this.weapons.cycle(1);
      if (inp.pressed('Digit1')) this.weapons.select(0);
      if (inp.pressed('Digit2')) this.weapons.select(1);
      if (inp.pressed('Digit3')) this.weapons.select(2);
    }
    if (inp.pressed('KeyF')) { if (this.vehicle) this.exitVehicle(); else this.tryEnterVehicle(); }

    if (this.vehicle) {
      if (this.vehicle.destroyed) this.exitVehicle(true);
      else {
        this.drive(dt);
        this.weapons.update(dt, false, false, this.cam.yaw);
        this.cam.update(dt, this.position, { vehicle: this.vehicle, colliders: this.near });
        return;
      }
    }

    const mv = this.walk(dt);
    const m = inp.mouse;
    const fireHeld = (m.locked && m.left) || inp.isDown('ControlLeft') || inp.isDown('ControlRight');
    const firePressed = (m.locked && m.leftPressed) || inp.pressed('ControlLeft') || inp.pressed('ControlRight');
    const fired = this.weapons.update(dt, fireHeld, firePressed, this.cam.yaw);
    const gunOut = !this.weapons.def.melee;
    if (fired && gunOut) this.aimT = 1.6;
    if (fired && !gunOut) this.aimT = 0.4;
    this.aimT = Math.max(0, (this.aimT || 0) - dt);

    // heading: face aim direction while shooting/punching, otherwise movement direction
    if (this.aimT > 0) this.heading = lerpAngle(this.heading, this.cam.yaw, 1 - Math.exp(-dt * 18));
    else if (mv.hs > 0.5) this.heading = lerpAngle(this.heading, Math.atan2(this.vel.x, this.vel.z), 1 - Math.exp(-dt * 12));

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.heading;
    this.character.update(dt, { speed: mv.hs, grounded: this.grounded, aiming: gunOut && this.aimT > 0, vy: this.vy });
    this.cam.update(dt, this.position, { colliders: this.near });
  }
}
