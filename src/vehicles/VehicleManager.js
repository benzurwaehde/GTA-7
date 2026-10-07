// Vehicles system: spawn/remove, enter/exit, damage + explosions, arcade physics stepping, car-vs-car, traffic & parked cars.
import * as THREE from 'three';
import { Vehicle } from './Vehicle.js';
import { Effects } from './effects.js';
import { setCarNight } from './models.js';
import { driveNPC, initAI, pickLanePoint, pickCurbPoint } from './traffic.js';

const TRAFFIC_TARGET = 25, PARKED_TARGET = 30;
const _v3 = new THREE.Vector3();

export class VehicleManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.effects = new Effects(game.scene);
    this.time = 0;
    this.manageT = 0;
    this.initialized = false;
    this.honkT = 0;
    // Real headlight cone for the player's car (one SpotLight only; NPC cars use emissive + road light pools).
    // It stays in the scene with intensity 0 by day, so the shader light count never changes.
    this.headSpot = new THREE.SpotLight(0xfff0cc, 0, 75, 0.62, 0.65, 1.1);
    this.headSpot.castShadow = false;
    this.headSpot.position.set(0, -50, 0);
    game.scene.add(this.headSpot, this.headSpot.target);
    this.nightF = 0;
  }

  // ---------------- public API ----------------
  spawn(type, x, z, heading = 0, opts = {}) {
    const v = new Vehicle(this, type, x, z, heading, opts);
    this.game.scene.add(v.mesh);
    this.list.push(v);
    if (opts.speed) { v.speed = opts.speed; v.vx = Math.sin(heading) * opts.speed; v.vz = Math.cos(heading) * opts.speed; }
    if (v.driver === 'npc') initAI(v);
    if (v.driver) v.owned = v.driver === 'player';
    return v;
  }

  remove(v) {
    const i = this.list.indexOf(v);
    if (i >= 0) this.list.splice(i, 1);
    if (v?.mesh) this.game.scene.remove(v.mesh);
  }

  getNearest(x, z, maxDist = Infinity, filterFn) {
    let best = null, bd = maxDist * maxDist;
    for (const v of this.list) {
      if (v.destroyed) continue;
      const dx = v.position.x - x, dz = v.position.z - z, d = dx * dx + dz * dz;
      if (d > bd) continue;
      if (filterFn && !filterFn(v)) continue;
      best = v; bd = d;
    }
    return best;
  }

  enter(v, who = 'player') {
    if (!v || v.destroyed) return null;
    const prev = v.driver;
    v.driver = who; v.sleeping = false;
    v.setControls({});
    if (who === 'npc') initAI(v); else v.ai = null;
    if (who === 'player') v.owned = true;
    if (who === 'player' && prev === 'npc') this.game.events.emit('vehicle:hijacked', { vehicle: v });
    return v;
  }

  // Frees the driver seat and returns a free spot beside the car.
  exit(v) {
    v.driver = null; v.ai = null; v.owned = true; v.sleeping = false;
    v.setControls({});
    const s = v.spec, fx = Math.sin(v.heading), fz = Math.cos(v.heading), rx = -fz, rz = fx;
    const side = s.W / 2 + 1.0;
    const cands = [[-rx, -rz, side], [rx, rz, side], [-fx, -fz, s.L / 2 + 1.2], [fx, fz, s.L / 2 + 1.2]];
    const boxes = this.game.world?.colliders || [];
    for (const [dx, dz, d] of cands) {
      const x = v.position.x + dx * d, z = v.position.z + dz * d;
      if (this.spotFree(x, z, 0.5, boxes, v)) return { x, z };
    }
    return { x: v.position.x - rx * side, z: v.position.z - rz * side };
  }

  spotFree(x, z, r, boxes, ignore) {
    for (const b of boxes) {
      if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return false;
    }
    for (const o of this.list) {
      if (o === ignore) continue;
      const dx = o.position.x - x, dz = o.position.z - z;
      if (dx * dx + dz * dz < (o.spec.W / 2 + r) ** 2 + (o.spec.L / 2) ** 2 * 0.5) {
        // rough: only reject when really inside the car footprint
        const fx = Math.sin(o.heading), fz = Math.cos(o.heading);
        const lf = dx * fx + dz * fz, ll = dx * -fz + dz * fx;
        if (Math.abs(lf) < o.spec.L / 2 + r && Math.abs(ll) < o.spec.W / 2 + r) return false;
      }
    }
    return true;
  }

  damage(v, amount) {
    if (!v || v.destroyed || !(amount > 0)) return;
    v.health = Math.max(0, v.health - amount);
    v.sleeping = false;
    if (v.health <= 0) this.explode(v);
  }

  explode(v) {
    if (v.destroyed) return;
    v.destroyed = true; v.health = 0; v.sirenOn = false;
    v.burnT = 16; v.hopV = 5; v.sleeping = false;
    v.vx *= 0.5; v.vz *= 0.5; v.ai = null;
    v.setControls({});
    v.blacken();
    const p = v.position;
    this.effects.explosion(p.x, 0, p.z);
    this.game.audio?.play?.('explosion', { x: p.x, z: p.z });
    this.game.events.emit('vehicle:destroyed', { vehicle: v });
    // blast: shove + hurt nearby
    for (const o of this.list.slice()) {
      if (o === v || o.destroyed) continue;
      const dx = o.position.x - p.x, dz = o.position.z - p.z, d = Math.hypot(dx, dz);
      if (d < 8) {
        const k = 1 - d / 8, inv = 1 / (d || 1);
        o.vx += dx * inv * 9 * k; o.vz += dz * inv * 9 * k; o.sleeping = false;
        this.damage(o, 35 * k);
      }
    }
    const pl = this.game.player;
    if (pl?.position && pl.vehicle !== v) {
      const d = Math.hypot(pl.position.x - p.x, pl.position.z - p.z);
      if (d < 7) pl.damage?.(45 * (1 - d / 7), 'explosion');
    }
    for (const ped of this.game.peds?.list || []) {
      if (!ped.position || ped.state === 'dead') continue;
      if (Math.hypot(ped.position.x - p.x, ped.position.z - p.z) < 7) this.game.peds.damage?.(ped, 100, 'explosion');
    }
  }

  // Called by physics on any collision. `other` is null for static geometry.
  registerImpact(a, b, impact) {
    if (impact < 3) return;
    const involved = d => d === 'player' || d === 'police';
    const hurt = involved(a.driver) || (b && involved(b.driver));
    if (impact > 6 && hurt) {
      const base = (impact - 6) * 3.2;
      this.damage(a, b ? base * 2 * b.mass / (a.mass + b.mass) : base);
      if (b) this.damage(b, base * 2 * a.mass / (a.mass + b.mass));
    }
    const ev = this.game.events;
    for (const [v, o] of [[a, b], [b, a]]) {
      if (!v || v.crashCd > 0) continue;
      v.crashCd = 0.25;
      ev.emit('vehicle:crash', { vehicle: v, impact, other: o || null });
      if (v === a) this.game.audio?.play?.('crash', { x: v.position.x, z: v.position.z, volume: Math.min(1, impact / 15) });
      // an NPC car hit by the player / police: honk, and on a hard hit speed away for a few seconds
      if (v.driver === 'npc' && o && (o.driver === 'player' || o.driver === 'police') && v.ai && impact > 3.5 && !v.destroyed) {
        if (!(v.ai.hitHonkCd > 0)) {
          v.ai.hitHonkCd = 3;
          this.game.audio?.play?.('horn', { x: v.position.x, z: v.position.z });
        }
        if (impact > 8) v.ai.fleeT = 5;
      }
    }
  }

  // ---------------- update ----------------
  update(dt) {
    dt = Math.min(dt, 0.05);
    if (dt <= 0) return;
    this.time += dt;
    const g = this.game;
    const pp = g.player?.position;
    const px = pp ? pp.x : 0, pz = pp ? pp.z : 0;

    if (!this.initialized && g.world) { this.initialized = true; this.populate(px, pz, true); }
    this.manageT -= dt;
    if (this.manageT <= 0) { this.manageT = 0.3; this.manage(px, pz); }

    const list = this.list;
    const boxes = g.world?.colliders;
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      if (v.crashCd > 0) v.crashCd -= dt;
      if (v.driver === 'npc' && !v.destroyed) driveNPC(v, dt, g, list, pp);
      v.step(dt, boxes);
    }
    this.carVsCar();
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      v.updateVisual(dt, this.time);
      this.emitEffects(v, dt);
    }
    this.effects.update(dt);
    this.updateNight(px, pz, pp);
  }

  // Night look: shared lamp materials, player's spot cone, additive light pools on the road for nearby driven cars.
  updateNight(px, pz, pp) {
    const w = this.game.world;
    const nf = w?.nightFactor ?? (w?.isNight ? 1 : 0);
    if (Math.abs(nf - this.nightF) > 0.005 || nf === 0 !== (this.nightF === 0)) { this.nightF = nf; setCarNight(nf); this.effects.setNight(nf); }
    const spot = this.headSpot, pv = this.game.player?.vehicle;
    if (nf > 0.03 && pv && !pv.destroyed) {
      const fx = Math.sin(pv.heading), fz = Math.cos(pv.heading), L = pv.spec.L / 2;
      spot.position.set(pv.position.x + fx * (L - 0.3), 0.85, pv.position.z + fz * (L - 0.3));
      spot.target.position.set(pv.position.x + fx * (L + 22), 0, pv.position.z + fz * (L + 22));
      spot.intensity = 260 * nf;
    } else { spot.intensity = 0; spot.position.y = -50; }
    const pools = this.effects.pools;
    if (nf < 0.03) { if (pools.n) { pools.begin(); pools.end(); } return; }
    pools.begin();
    for (const v of this.list) {
      if (v.driver === null || v.destroyed) continue;
      const dx = v.position.x - px, dz = v.position.z - pz;
      if (dx * dx + dz * dz > 130 * 130) continue;
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading), L = v.spec.L / 2, h = v.heading;
      const own = v === pv ? 0.55 : 1;
      pools.add(v.position.x + fx * (L + 4.2), v.position.z + fz * (L + 4.2), h, 4.6, 10.5, 0.55 * nf * own, 0.48 * nf * own, 0.32 * nf * own);
      const br = v.braking ? 0.95 : 0.4;
      pools.add(v.position.x - fx * (L + 1.0), v.position.z - fz * (L + 1.0), h, 3.4, 3.2, br * nf, 0.06 * br * nf, 0.03 * br * nf);
    }
    pools.end();
  }

  // Tire marks while drifting, handbraking or braking hard (rear wheels only), near the player.
  emitSkid(v, dt) {
    const sp = Math.hypot(v.vx, v.vz);
    if (sp < 4) { v._skidD = 0; return; }
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const slip = Math.abs(v.vx * -fz + v.vz * fx);
    const c = v.controls;
    if (!(slip > 2.4 || (c.handbrake && v.driver) || (c.brake > 0.8 && sp > 14) || (c.throttle < -0.5 && v.speed > 10))) { v._skidD = 0; return; }
    const pp = this.game.player?.position;
    if (pp && Math.abs(pp.x - v.position.x) + Math.abs(pp.z - v.position.z) > 140) return;
    v._skidD = (v._skidD || 0) + sp * dt;
    if (v._skidD < 0.6) return;
    const d = v._skidD * 1.12;     // one quad per travelled stretch, centred half a stretch behind the wheel
    v._skidD = 0;
    const dir = Math.atan2(v.vx, v.vz), dx = v.vx / sp, dz = v.vz / sp, zr = v.model.zr ?? -v.spec.wb / 2, tr = v.spec.W / 2 - 0.12;
    const bx = v.position.x + fx * zr - dx * d * 0.5, bz = v.position.z + fz * zr - dz * d * 0.5;
    for (const s of [-1, 1]) this.effects.skid(bx + -fz * tr * s, bz + fx * tr * s, dir, d, 0.12);
  }

  emitEffects(v, dt) {
    if (!v.destroyed && v.driver !== null) this.emitSkid(v, dt);
    let rate = 0, fire = 0;
    if (v.destroyed) { if (v.burnT > 0) { v.burnT -= dt; rate = 7; fire = 9; } else if (v.burnT > -20) { v.burnT -= dt; rate = 2; } }
    else if (v.health < 30) {
      rate = 2 + (30 - v.health) * 0.25;
      if (v.health < 15) { fire = 4; this.damage(v, 2.5 * dt); }
    }
    if (!rate) return;
    const pp = this.game.player?.position;
    if (pp && Math.abs(pp.x - v.position.x) + Math.abs(pp.z - v.position.z) > 220) return;
    const L = v.spec.L, ox = Math.sin(v.heading) * L * 0.3, oz = Math.cos(v.heading) * L * 0.3;
    v._sm = (v._sm || 0) + rate * dt;
    while (v._sm >= 1) { v._sm -= 1; this.effects.smokePuff(v.position.x + ox, v.position.y + 1.1, v.position.z + oz, v.destroyed ? 1.5 : 1); }
    v._fi = (v._fi || 0) + fire * dt;
    while (v._fi >= 1) { v._fi -= 1; this.effects.firePuff(v.position.x + ox * 0.6, v.position.y + 0.9, v.position.z + oz * 0.6); }
  }

  carVsCar() {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (a.sleeping && b.sleeping) continue;
        const ddx = b.position.x - a.position.x, ddz = b.position.z - a.position.z;
        const maxD = (a.spec.L + b.spec.L) / 2 + 0.3;
        if (ddx * ddx + ddz * ddz > maxD * maxD) continue;
        const afx = Math.sin(a.heading), afz = Math.cos(a.heading), bfx = Math.sin(b.heading), bfz = Math.cos(b.heading);
        let best = null;
        for (const ka of [1, -1]) for (const kb of [1, -1]) {
          const ax = a.position.x + afx * a.coff * ka, az = a.position.z + afz * a.coff * ka;
          const bx = b.position.x + bfx * b.coff * kb, bz = b.position.z + bfz * b.coff * kb;
          const dx = ax - bx, dz = az - bz, rr = a.cr + b.cr, d2 = dx * dx + dz * dz;
          if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2) || 0.001, ov = rr - d;
          if (!best || ov > best.ov) best = { ov, nx: dx / d, nz: dz / d, ax: ax - a.position.x, az: az - a.position.z, bx: bx - b.position.x, bz: bz - b.position.z };
        }
        if (!best) continue;
        a.sleeping = false; b.sleeping = false;
        const ma = a.mass, mb = b.mass, fa = mb / (ma + mb);
        a.position.x += best.nx * best.ov * fa; a.position.z += best.nz * best.ov * fa;
        b.position.x -= best.nx * best.ov * (1 - fa); b.position.z -= best.nz * best.ov * (1 - fa);
        const rvx = a.vx - b.vx, rvz = a.vz - b.vz, vn = rvx * best.nx + rvz * best.nz;
        if (vn < 0) {
          const j2 = -(1.25) * vn / (1 / ma + 1 / mb);
          a.vx += best.nx * j2 / ma; a.vz += best.nz * j2 / ma;
          b.vx -= best.nx * j2 / mb; b.vz -= best.nz * j2 / mb;
          const I = 1.9, jx = best.nx * -vn, jz = best.nz * -vn;
          a.yawVel = Math.max(-3, Math.min(3, a.yawVel + 0.4 * (jx * best.az - jz * best.ax) / I * (mb / (ma + mb)) * 2));
          b.yawVel = Math.max(-3, Math.min(3, b.yawVel - 0.4 * (jx * best.bz - jz * best.bx) / I * (ma / (ma + mb)) * 2));
          a.speed = a.vx * afx + a.vz * afz; b.speed = b.vx * bfx + b.vz * bfz;
          this.registerImpact(a, b, -vn);
        }
      }
    }
  }

  // ---------------- traffic ----------------
  inView(x, z) {
    const cam = this.game.camera;
    if (!cam) return false;
    _v3.set(x, 1, z).project(cam);
    return _v3.z < 1 && Math.abs(_v3.x) < 1.2 && Math.abs(_v3.y) < 1.2;
  }

  clearSpot(x, z, d = 8) {
    for (const o of this.list) { const dx = o.position.x - x, dz = o.position.z - z; if (dx * dx + dz * dz < d * d) return false; }
    return true;
  }

  populate(px, pz, initial) {
    for (let i = 0; i < TRAFFIC_TARGET; i++) this.spawnTraffic(px, pz, true);
    for (let i = 0; i < PARKED_TARGET; i++) this.spawnParked(px, pz, true);
  }

  randomType(traffic) {
    const r = Math.random();
    if (r < 0.42) return 'sedan';
    if (r < 0.58) return 'taxi';
    if (r < 0.76) return traffic ? 'sports' : 'sports';
    return 'truck';
  }

  spawnTraffic(px, pz, initial = false) {
    const p = pickLanePoint(this.game, px, pz, initial ? 25 : 80, initial ? 150 : 150);
    if (!p || !this.clearSpot(p.x, p.z, 9)) return null;
    if (!initial && this.inView(p.x, p.z)) return null;
    const type = this.randomType(true);
    const v = this.spawn(type, p.x, p.z, p.heading, { driver: 'npc' });
    const sp = v.spec.top * v.spec.cruise * 0.8;
    v.speed = sp; v.vx = Math.sin(p.heading) * sp; v.vz = Math.cos(p.heading) * sp;
    return v;
  }

  spawnParked(px, pz, initial = false) {
    const p = pickCurbPoint(this.game, px, pz, initial ? 15 : 70, initial ? 150 : 170);
    if (!p || !this.clearSpot(p.x, p.z, 6.5)) return null;
    if (!initial && this.inView(p.x, p.z)) return null;
    const v = this.spawn(Math.random() < 0.15 ? 'truck' : this.randomType(false), p.x, p.z, p.heading, { driver: null });
    if (v.type === 'taxi' && Math.random() < 0.5) { /* keep */ }
    v.sleeping = true;
    return v;
  }

  manage(px, pz) {
    let traffic = 0, parked = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const v = this.list[i];
      const dx = v.position.x - px, dz = v.position.z - pz, d = Math.hypot(dx, dz);
      if (v.driver === 'npc' && !v.destroyed) {
        const idle = v.ai?.idle || 0;
        // owned npc cars (e.g. a mission target) only despawn very far away
        if (v.owned) { if (d > 450) this.remove(v); else traffic++; continue; }
        if (d > 200 || idle > 30 || (idle > 10 && d > 50 && !this.inView(v.position.x, v.position.z))) { this.remove(v); continue; }
        traffic++;
      } else if (v.destroyed) {
        if (d > 250 || (v.burnT < -15 && d > 60 && !this.inView(v.position.x, v.position.z))) { this.remove(v); continue; }
      } else if (v.driver === null) {
        if (v.owned) { if (d > 450) this.remove(v); continue; }
        if (d > 260 && !this.inView(v.position.x, v.position.z)) { this.remove(v); continue; }
        if (d < 260) parked++;
      }
    }
    for (let k = 0; k < 2 && traffic < TRAFFIC_TARGET; k++) if (this.spawnTraffic(px, pz)) traffic++;
    for (let k = 0; k < 2 && parked < PARKED_TARGET; k++) if (this.spawnParked(px, pz)) parked++;
  }
}
