// Street-AI: wanted level, crimes, police cars + cops on foot, evasion and busting.
import * as THREE from 'three';
import { CITY, ROAD_LINES } from '../core/config.js';
import { ColliderGrid } from '../npc/ColliderGrid.js';
import { nearestIndex, nearestNode, nodePos, randomNodeAround, sidewalkPath } from '../npc/sidewalk.js';
import { inView, playerPos, wrapAngle } from '../npc/view.js';
import { Helicopter } from '../vehicles/Helicopter.js';

const B = CITY.blocks;
const FOOT_TARGET = [0, 2, 2, 3, 4, 5];
const CAR_TARGET = [0, 0, 2, 3, 4, 5];
const SHOOT_CD = [0, 0, 1.4, 1.1, 0.8, 0.6];
const SHOOT_DMG = [0, 0, 3, 4, 5, 7];
const FORGET_TIME = 20;
const LANE = CITY.roadWidth / 4;      // lane center offset from the road center (matches vehicles/traffic.js)
const FAR = 60;                       // beyond this distance police cars keep to the right lane
const BLOCK_DIST = 85;                // roadblock distance ahead of the player
const HELI_DELAY = 4, HELI_COOLDOWN = 45;   // seconds: after reaching 5 stars / after a helicopter was shot down
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Shortest path over the road-intersection grid (BFS). Returns [{x,z}...] from start to goal.
function roadPath(si, sj, gi, gj) {
  const key = (i, j) => i * (B + 1) + j;
  const prev = new Map([[key(si, sj), null]]);
  const q = [[si, sj]];
  for (let h = 0; h < q.length; h++) {
    const [i, j] = q[h];
    if (i === gi && j === gj) break;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni > B || nj > B || prev.has(key(ni, nj))) continue;
      prev.set(key(ni, nj), key(i, j)); q.push([ni, nj]);
    }
  }
  const out = [];
  for (let k = key(gi, gj); k !== null && k !== undefined; k = prev.get(k)) {
    out.push({ x: ROAD_LINES[Math.floor(k / (B + 1))], z: ROAD_LINES[k % (B + 1)] });
  }
  return out.reverse();
}
const sameCell = (si, sj, gi, gj, c) => c.pathKey === ((si * 16 + sj) * 16 + gi) * 16 + gj;


// Pure-pursuit target: nearest point on the polyline plus `look` meters ahead along it.
function pursuitTarget(path, x, z, look, out) {
  if (!path || path.length < 2) return null;
  let bi = 0, bt = 0, bd = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const sx = b.x - a.x, sz = b.z - a.z, l2 = sx * sx + sz * sz || 1;
    const t = clamp(((x - a.x) * sx + (z - a.z) * sz) / l2, 0, 1);
    const d = Math.hypot(a.x + sx * t - x, a.z + sz * t - z);
    if (d < bd - 0.01) { bd = d; bi = i; bt = t; }
  }
  let rem = look, i = bi, t = bt;
  for (;;) {
    const a = path[i], b = path[i + 1], l = Math.hypot(b.x - a.x, b.z - a.z);
    const left = l * (1 - t);
    if (rem <= left || i >= path.length - 2) { const k = Math.min(1, t + rem / (l || 1)); out.x = a.x + (b.x - a.x) * k; out.z = a.z + (b.z - a.z) * k; return out; }
    rem -= left; i++; t = 0;
  }
}

export class Police {
  constructor(game) {
    this.game = game;
    this.wanted = 0;
    this.heat = 0;
    this.unseenT = 0;
    this.bustT = 0;
    this.bustCd = 0;
    this.cops = [];      // foot cops (ped objects)
    this.cars = [];      // { vehicle, state, ... }
    this.block = null;   // active roadblock { cars: [entry, entry] }
    this.blockT = 0.5; this.blockTry = 0;
    this.grid = new ColliderGrid(game);
    this.footTimer = 0; this.carTimer = 0;
    this.noCars = false;
    this.steerCal = -1; // vehicles: steer +1 = turn right = heading decreases
    this.kills = [];
    this.crimeCd = 0;
    this.lastShotT = -99;
    this.lastHealth = new WeakMap();
    this.pHave = false; this.pPx = 0; this.pPz = 0; this.pSpeed = 0;
    this._pt = { x: 0, z: 0 }; this._ctl = { throttle: 0, steer: 0, brake: 0, handbrake: false };
    this._mv = { x: 0, z: 0 }; this._tgt = { x: 0, z: 0 };   // scratch results for foot-cop movement
    this.noCarsT = 0; this.blockDbg = '';
    this.tracers = [];
    this.elapsed = 0;
    this.helicopter = null;    // active Helicopter (5 stars) or null; weapons call helicopter.hit(point, dmg)
    this.heliCd = HELI_DELAY;
    this._lt = { x: 0, z: 0 };  // scratch: leave target
    this._opt = { aggressive: false, slowNear: false, avoid: false };   // scratch: drive options

    const ev = game.events;
    ev?.on('ped:killed', e => this._onKilled(e));
    ev?.on('ped:damaged', e => {
      if (e?.ped?.isCop && e.source === 'player' && this.crimeCd <= 0) { this.crimeCd = 2; this.addHeat(1); }
    });
    ev?.on('weapon:fired', e => this._onWeapon(e));
    ev?.on('vehicle:hijacked', () => this._onHijack());
    ev?.on('vehicle:crash', e => this._onCrash(e));
    ev?.on('player:died', () => this.reset());
    ev?.on('player:busted', () => this.reset());
  }

  // ---------- public API ----------
  setWanted(n) {
    n = clamp(Math.round(n) || 0, 0, 5);
    this.heat = n;
    this._apply(n);
  }
  addHeat(n, cap = 5) {
    let h = this.heat + n;
    if (h > cap) h = Math.max(this.heat, cap);
    this.heat = clamp(h, 0, 5);
    this.unseenT = 0;
    this._apply(Math.min(5, Math.floor(this.heat + 1e-6)));
  }
  reset() {
    this.heat = 0; this.bustT = 0; this.unseenT = 0;
    this._apply(0);
    this._despawnAll();
  }

  _apply(level) {
    const g = this.game;
    const old = this.wanted;
    this.wanted = level;
    if (g.state) g.state.wanted = level;
    if (level !== old) {
      g.events?.emit('wanted:changed', { level });
      g.events?.emit('hud:message', { text: level > 0 ? `Wanted level: ${'★'.repeat(level)}` : 'Wanted level lost', duration: 2.5 });
      this.unseenT = 0;
      if (level > 0 && old === 0) { this.footTimer = 0.5; this.carTimer = 2; }
      if (level === 0) this._releaseUnits();
    }
  }

  // ---------- crime hooks ----------
  _onKilled({ ped, source } = {}) {
    if (!ped) return;
    if (ped.isCop) {
      const i = this.cops.indexOf(ped); if (i >= 0) this.cops.splice(i, 1);
      if (source === 'player') { this.addHeat(2); this.game.events?.emit('hud:message', { text: 'Cop killed', duration: 2 }); }
      return;
    }
    if (source === 'player') {
      const t = this.elapsed;
      this.kills = this.kills.filter(k => t - k < 45); this.kills.push(t);
      this.addHeat(this.kills.length >= 3 ? 2 : this.kills.length === 2 ? 1.5 : 1);
    }
  }
  _witness(x, z, civR, copR) {
    const peds = this.game.peds?.list;
    if (peds) for (let i = 0; i < peds.length; i++) {
      const p = peds[i];
      if (!p.alive) continue;
      const d = Math.hypot(p.position.x - x, p.position.z - z);
      if (p.isCop ? d < copR : d < civR) return p.isCop ? 2 : 1;
    }
    return 0;
  }
  _onWeapon(e) {
    if (!e || e.source === 'police') return;
    const id = e.weapon?.id ?? e.weapon;
    if (id === 'fists' || id === 'fist') return;
    const p = e.position || playerPos(this.game);
    this.lastShotT = this.elapsed;
    const w = this._witness(p.x, p.z, 30, 55);
    if (w === 2) this.addHeat(0.5, 2.99);
    else if (w === 1) this.addHeat(0.2, 1.99);
  }
  _onHijack() {
    const p = playerPos(this.game);
    if (this._witness(p.x, p.z, 30, 30)) this.addHeat(1);
  }
  _onCrash(e) {
    if (!e?.vehicle || this.crimeCd > 0 || (e.impact ?? 0) < 4) return;
    const pv = this.game.player?.vehicle;
    if (!pv) return;
    const v = e.vehicle;
    let hitCop = false;
    if (v.isPolice && v !== pv && v.position.distanceTo(pv.position) < 9) hitCop = true;
    const vl = this.game.vehicles?.list;
    if (v === pv && vl) for (let i = 0; i < vl.length; i++) { const c = vl[i]; if (c.isPolice && c !== pv && c.position.distanceTo(pv.position) < 6) hitCop = true; }
    if (hitCop) { this.crimeCd = 3; this.addHeat(1); }
  }
  _watchPoliceCars() {
    const g = this.game, pv = g.player?.vehicle;
    const vl = g.vehicles?.list;
    if (!vl) return;
    for (let i = 0; i < vl.length; i++) {
      const v = vl[i];
      if (!v.isPolice) continue;
      const last = this.lastHealth.get(v);
      this.lastHealth.set(v, v.health);
      if (last === undefined || v.health >= last - 0.5 || this.crimeCd > 0) continue;
      const pp = playerPos(g);
      const dist = Math.hypot(v.position.x - pp.x, v.position.z - pp.z);
      const shot = this.elapsed - this.lastShotT < 0.7 && dist < 90;
      const rammed = pv && pv !== v && dist < 9;
      if (shot || rammed) { this.crimeCd = 3; this.addHeat(1); }
    }
  }

  // ---------- main update ----------
  update(dt) {
    const g = this.game;
    this.elapsed += dt;
    this.crimeCd -= dt; this.bustCd -= dt;
    // external writes to game.state.wanted (missions etc.)
    if (g.state && g.state.wanted !== this.wanted) this.setWanted(g.state.wanted);
    this._updateTracers(dt);
    this._watchPoliceCars();

    const pp = playerPos(g);
    if (this.pHave) this.pSpeed = Math.hypot(pp.x - this.pPx, pp.z - this.pPz) / Math.max(dt, 1e-4);
    this.pPx = pp.x; this.pPz = pp.z; this.pHave = true;
    if (this.noCars && (this.noCarsT -= dt) <= 0) this.noCars = false;   // vehicle spawning may work again
    const alive = g.player ? g.player.alive !== false : true;

    // in-place compaction (no per-frame arrays)
    const pl = g.peds?.list;
    let w = 0;
    for (let i = 0; i < this.cops.length; i++) { const c = this.cops[i]; if (pl && pl.includes(c) && c.alive) this.cops[w++] = c; }
    this.cops.length = w;
    w = 0;
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i];
      if (!c.vehicle.destroyed && (c.state === 'parked' || c.vehicle.driver === 'police' || c.vehicle.driver === null)) this.cars[w++] = c;
    }
    this.cars.length = w;
    for (let i = 0; i < this.cars.length; i++) { const c = this.cars[i]; if (c.state !== 'parked' && c.state !== 'leave' && c.vehicle.driver !== 'police') c.state = 'parked'; }

    if (this.wanted > 0) {
      if (alive) {
        this._spawnLogic(dt, pp);
        for (let i = 0; i < this.cars.length; i++) this._updateCar(this.cars[i], dt, pp);
        this._roadblock(dt, pp);
        for (let i = 0; i < this.cops.length; i++) this._updateCop(this.cops[i], dt, pp);
        this._evasion(dt, pp);
        this._busting(dt, pp);
      } else {
        for (let i = 0; i < this.cops.length; i++) { const c = this.cops[i]; c.cmd.vx = c.cmd.vz = 0; }
      }
    } else if (this.cars.length || this.cops.length) {
      this._updateLeaving(dt, pp);
    }
    this._updateHeli(dt, pp, alive);
  }

  // ---------- helicopter (5 stars) ----------
  _updateHeli(dt, pp, alive) {
    let h = this.helicopter;
    if (h && h.dead) { h = this.helicopter = null; this.heliCd = HELI_COOLDOWN; }
    if (!h) {
      if (this.wanted >= 5 && alive && this.game.scene) {
        if ((this.heliCd -= dt) <= 0) { h = this.helicopter = new Helicopter(this.game, this); h.start(pp); }
      } else this.heliCd = Math.max(this.heliCd, HELI_DELAY);
      return;
    }
    if (this.wanted < 5 || !alive) h.leave();
    h.update(dt, pp);
    if (h.state === 'leave') {          // gone once it is far away (or lost for good)
      const d = Math.hypot(h.position.x - pp.x, h.position.z - pp.z);
      if (d > 260 || h.stateT > 30) h.dispose();
    }
  }

  // ---------- spawning ----------
  _spawnLogic(dt, pp) {
    const L = this.wanted;
    let footWant = FOOT_TARGET[L], carWant = CAR_TARGET[L];
    if (this.noCars) { footWant += carWant; carWant = 0; }
    let activeCars = 0;
    for (let i = 0; i < this.cars.length; i++) { const c = this.cars[i]; if (c.state !== 'leave' && !c.block) activeCars++; }
    const activeCops = this.cops.length;
    this.footTimer -= dt; this.carTimer -= dt;
    if (activeCops < footWant && activeCops < 12 && this.footTimer <= 0) {
      this.footTimer = 2.5;
      this._spawnFootCop(pp);
    }
    if (activeCars < carWant && this.cars.length < 9 && this.carTimer <= 0) {
      this.carTimer = 3.5;
      this._spawnCar(pp);
    }
    // recycle units that are hopelessly far away or stuck
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const c = this.cops[i], d = Math.hypot(c.position.x - pp.x, c.position.z - pp.z);
      if (d > 170) this._removeCop(c);
    }
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i], d = Math.hypot(c.vehicle.position.x - pp.x, c.vehicle.position.z - pp.z);
      if (d > 230 || (c.state === 'parked' && d > 120 && !inView(this.game, c.vehicle.position.x, c.vehicle.position.z))) this._removeCar(c);
    }
  }

  _spawnFootCop(pp) {
    const peds = this.game.peds;
    if (!peds?.spawnCop) return;
    let n = randomNodeAround(pp.x, pp.z, 45, 80, 14, (x, z) => inView(this.game, x, z));
    if (!n) n = randomNodeAround(pp.x, pp.z, 70, 110, 14);
    if (!n) return;
    const p = nodePos(n);
    const cop = peds.spawnCop(p.x, p.z);
    cop.cop = { cd: 1 + Math.random(), path: null, pathT: 0, strafeT: 0, strafeDir: 1, dismounted: false };
    this.cops.push(cop);
  }

  _roadSpawnPoint(pp) {
    const w = this.game.world;
    if (w?.randomRoadPoint) {
      for (let t = 0; t < 6; t++) {
        const r = w.randomRoadPoint(pp.x, pp.z, 130);
        if (!r) break;
        const d = Math.hypot(r.x - pp.x, r.z - pp.z);
        if (d > 70 && d < 170 && !inView(this.game, r.x, r.z)) return { x: r.x, z: r.z, heading: r.heading ?? 0 };
      }
    }
    for (let t = 0; t < 14; t++) {
      const a = Math.random() * Math.PI * 2, dist = 85 + Math.random() * 55;
      const qx = clamp(pp.x + Math.cos(a) * dist, -CITY.half + 12, CITY.half - 12);
      const qz = clamp(pp.z + Math.sin(a) * dist, -CITY.half + 12, CITY.half - 12);
      let x, z, h;
      if (Math.random() < 0.5) {
        const r = ROAD_LINES[nearestIndex(qx)]; z = qz; h = pp.z > z ? 0 : Math.PI;
        x = r + (h === 0 ? -3.5 : 3.5);
      } else {
        const r = ROAD_LINES[nearestIndex(qz)]; x = qx; h = pp.x > x ? Math.PI / 2 : -Math.PI / 2;
        z = r + (h > 0 ? 3.5 : -3.5);
      }
      const d = Math.hypot(x - pp.x, z - pp.z);
      if (d < 70) continue;
      if (t < 10 && inView(this.game, x, z)) continue;
      return { x, z, heading: h };
    }
    return null;
  }

  _spawnCar(pp) {
    const veh = this.game.vehicles;
    if (!veh?.spawn) { this.noCars = true; this.noCarsT = 5; return; }
    const sp = this._roadSpawnPoint(pp);
    if (!sp) return;
    const v = veh.spawn('police', sp.x, sp.z, sp.heading, { driver: 'police' });
    if (!v) { this.noCars = true; this.noCarsT = 5; return; }
    if (v.driver !== 'police') veh.enter?.(v, 'police');
    v.driver = 'police';
    v.sirenOn = true;
    this.cars.push({
      vehicle: v, state: 'chase', stuckT: 0, reverseT: 0, revSteer: 1, path: null, pathT: 0, lastHeading: v.heading,
      lastRaw: 0, totalStuck: 0, age: 0, leaveT: 0,
    });
  }

  _removeCop(c) { const i = this.cops.indexOf(c); if (i >= 0) this.cops.splice(i, 1); this.game.peds?.removePed?.(c); }
  _removeCar(c) {
    const i = this.cars.indexOf(c); if (i >= 0) this.cars.splice(i, 1);
    c.vehicle.sirenOn = false;
    this.game.vehicles?.remove?.(c.vehicle);
  }
  _despawnAll() {
    for (let i = this.cops.length - 1; i >= 0; i--) this._removeCop(this.cops[i]);
    for (let i = this.cars.length - 1; i >= 0; i--) this._removeCar(this.cars[i]);
    this.cops.length = 0; this.cars.length = 0; this.block = null; this.blockT = 0.5; this.blockTry = 0;
    if (this.helicopter) { this.helicopter.dispose(); this.helicopter = null; this.heliCd = HELI_DELAY; }
  }
  _releaseUnits() {
    this.block = null;
    for (let i = 0; i < this.cars.length; i++) { const c = this.cars[i]; if (c.state !== 'parked') c.state = 'leave'; c.leaveT = 0; c.vehicle.sirenOn = false; }
    for (let i = 0; i < this.cops.length; i++) { const c = this.cops[i]; c.cop.leave = true; c.cop.leaveT = 0; }
  }

  // ---------- cars ----------
  _updateCar(c, dt, pp) {
    const v = c.vehicle, g = this.game;
    c.age += dt;
    if (c.state === 'parked') { const k = this._ctl; k.throttle = 0; k.steer = 0; k.brake = 1; k.handbrake = true; v.setControls?.(k); return; }
    v.sirenOn = true;
    const pv = g.player?.vehicle;
    const tx0 = pv ? pv.position.x + Math.sin(pv.heading) * pv.speed * 0.4 : pp.x;
    const tz0 = pv ? pv.position.z + Math.cos(pv.heading) * pv.speed * 0.4 : pp.z;
    const dx = pp.x - v.position.x, dz = pp.z - v.position.z;
    const d = Math.hypot(dx, dz);
    const onFoot = !pv;

    // dismount near an on-foot (or stationary) player
    const playerStill = onFoot || Math.abs(pv.speed) < 3;
    if (d < 28 && playerStill && Math.abs(v.speed) < 5) { this._dismount(c, pp); return; }
    if (d < 45 && c.totalStuck > 5) { this._dismount(c, pp); return; }

    let tx = tx0, tz = tz0;
    const direct = d < 55 && this.grid.lineClear(v.position.x, v.position.z, pp.x, pp.z);
    if (!direct) {
      c.pathT -= dt;
      if (c.pathT <= 0 || !c.path) {
        c.pathT = 1.2;
        // the BFS only reruns when the car or the player changed road cell; otherwise just move the final point
        const si = nearestIndex(v.position.x), sj = nearestIndex(v.position.z), gi = nearestIndex(pp.x), gj = nearestIndex(pp.z);
        if (c.path && sameCell(si, sj, gi, gj, c)) { const e = c.path[c.path.length - 1]; e.x = pp.x; e.z = pp.z; }
        else {
          c.path = roadPath(si, sj, gi, gj);
          c.path.push({ x: pp.x, z: pp.z });
          c.pathKey = ((si * 16 + sj) * 16 + gi) * 16 + gj;
        }
      }
      if (d > 30) {
        const t = pursuitTarget(c.path, v.position.x, v.position.z, 18, this._pt);
        if (t) { tx = t.x; tz = t.z; }
      }
    }
    // far from the target: stay in the right lane (shift the aim point to the right of the travel direction)
    const laneK = clamp((d - (FAR - 15)) / 15, 0, 1);
    if (laneK > 0) {
      const lx = tx - v.position.x, lz = tz - v.position.z, ll = Math.hypot(lx, lz) || 1;
      tx += -lz / ll * LANE * laneK; tz += lx / ll * LANE * laneK;
    }
    const o = this._opt; o.aggressive = this.wanted >= 4 || !!pv; o.slowNear = onFoot && d < 40; o.avoid = d > 40;
    this._drive(c, dt, tx, tz, o);
  }

  _drive(c, dt, tx, tz, opt) {
    const v = c.vehicle;
    const dx = tx - v.position.x, dz = tz - v.position.z;
    const d = Math.hypot(dx, dz);
    let err = wrapAngle(Math.atan2(dx, dz) - v.heading);
    let raw = clamp(err * 1.6, -1, 1);
    let throttle = 1, brake = 0, handbrake = false;
    const sp = v.speed || 0;

    c.lastHeading = v.heading;

    // dodge traffic ahead: steer around it, brake if it is close and in our way
    if (opt.avoid) {
      const hx = Math.sin(v.heading), hz = Math.cos(v.heading), look = 12 + Math.abs(sp) * 0.7, pv = this.game.player?.vehicle;
      let best = null, bf = look, bl = 0;
      const vl = this.game.vehicles?.list;
      if (vl) for (let i = 0; i < vl.length; i++) {
        const o = vl[i];
        if (o === v || o === pv || o.destroyed || !o.position) continue;
        const rx = o.position.x - v.position.x, rz = o.position.z - v.position.z;
        const f = rx * hx + rz * hz;
        if (f < 1 || f > bf) continue;
        const l = rx * -hz + rz * hx;           // lateral offset, positive = to the right
        if (Math.abs(l) > 3.2) continue;
        best = o; bf = f; bl = l;
      }
      if (best) {
        const k = 1 - Math.abs(bl) / 3.2;
        raw = clamp(raw + (bl >= 0 ? 1 : -1) * 0.9 * (0.4 + k), -1, 1);   // obstacle on the right -> steer left
        if (bf < 6 + Math.abs(sp) * 0.25 && Math.abs(bl) < 2) { throttle = 0; brake = Math.max(brake, 0.6); }
      }
    }
    const maxSp = 26 + this.wanted * 3 + (opt.aggressive ? 6 : 0);
    if (Math.abs(err) > 1.1 && sp > 9) { throttle = 0; brake = 0.7; }
    else if (Math.abs(err) > 0.6 && sp > 13) { throttle = 0; brake = 0.4; }
    else if (sp > maxSp) throttle = 0;
    if (opt.slowNear && d < 28) { throttle = d < 14 ? 0 : 0.35; brake = d < 14 ? 1 : 0; handbrake = d < 8; }

    // stuck / reverse handling
    if (c.reverseT > 0) {
      c.reverseT -= dt; throttle = -1; brake = 0; raw = -c.revSteer; handbrake = false;
    } else if (Math.abs(sp) < 1.2 && throttle > 0.3 && !opt.slowNear) {
      c.stuckT += dt; c.totalStuck += dt;
      if (c.stuckT > 1.4) { c.reverseT = 1.3; c.stuckT = 0; c.revSteer = raw >= 0 ? 1 : -1; }
    } else { c.stuckT = 0; c.totalStuck = Math.max(0, c.totalStuck - dt * 0.5); }

    c.lastRaw = c.reverseT > 0 ? 0 : raw;
    const k = this._ctl; k.throttle = throttle; k.steer = raw * this.steerCal; k.brake = brake; k.handbrake = handbrake;
    v.setControls?.(k);
  }

  _dismount(c, pp) {
    const v = c.vehicle;
    v.setControls?.({ throttle: 0, steer: 0, brake: 1, handbrake: true });
    let ex = v.position.x + 2.5, ez = v.position.z;
    const out = this.game.vehicles?.exit?.(v);
    if (out && Number.isFinite(out.x)) { ex = out.x; ez = out.z; }
    c.state = 'parked';
    const n = this.wanted >= 3 ? 2 : 1;
    const peds = this.game.peds;
    for (let i = 0; i < n && peds?.spawnCop; i++) {
      const cop = peds.spawnCop(ex + i * 1.1, ez + i * 0.6);
      cop.cop = { cd: 0.8 + Math.random(), path: null, pathT: 0, strafeT: 0, strafeDir: 1 };
      this.cops.push(cop);
    }
    v.sirenOn = true;
  }

  // ---------- roadblocks (4+ stars) ----------
  _roadblock(dt, pp) {
    const g = this.game, B = this.block;
    if (B) {
      let alive = 0;
      for (let i = 0; i < B.cars.length; i++) if (this.cars.includes(B.cars[i])) alive++;
      const p = B.cars[0].vehicle.position, d = Math.hypot(p.x - pp.x, p.z - pp.z);
      const dot = (p.x - pp.x) * B.fx + (p.z - pp.z) * B.fz;   // > 0: still ahead of the player
      const gone = alive < B.cars.length || d > 170 || (dot < 0 && d > 45) || (this.wanted < 4 && !inView(g, p.x, p.z));
      if (gone) { for (let i = B.cars.length - 1; i >= 0; i--) this._removeCar(B.cars[i]); this.block = null; this.blockT = 8; }
      return;
    }
    if (this.wanted < 4) return;
    this.blockT -= dt;
    if (this.blockT > 0) return;
    // Retry quickly on any failure. (Earlier version gave up for good via noCars, and silently on the map edge.)
    this.blockT = 1;
    if (!g.vehicles?.spawn) { this.blockDbg = 'no-spawn-fn'; return; }
    const pv = g.player?.vehicle;
    let fx, fz;
    if (pv && Math.abs(pv.speed) > 2) { fx = Math.sin(pv.heading) * Math.sign(pv.speed); fz = Math.cos(pv.heading) * Math.sign(pv.speed); }
    else { const h = g.player?.heading ?? 0; fx = Math.sin(h); fz = Math.cos(h); }
    let alongX = Math.abs(fx) > Math.abs(fz);
    let s = (alongX ? fx : fz) >= 0 ? 1 : -1;
    const lim = CITY.half - 15;
    // try ahead first; if that runs off the map try the other direction, then the other axis
    let a = 0, ok = false;
    for (let t = 0; t < 3 && !ok; t++) {
      if (t === 1) s = -s; else if (t === 2) { alongX = !alongX; s = (alongX ? pp.x : pp.z) > 0 ? -1 : 1; }
      const dist = BLOCK_DIST - this.blockTry * 7;       // vary the distance on retries
      a = (alongX ? pp.x : pp.z) + s * Math.max(55, dist);
      const rc = ROAD_LINES[nearestIndex(a)];
      if (Math.abs(a - rc) < 16) a = rc + (a >= rc ? 1 : -1) * 18;   // keep it off the junction itself
      a = clamp(a, -lim, lim);
      const rc2 = ROAD_LINES[nearestIndex(a)];
      ok = Math.abs(a - rc2) >= 14;
    }
    if (!ok) { this.blockDbg = 'edge'; this.blockTry++; return; }
    const rl = ROAD_LINES[nearestIndex(alongX ? pp.z : pp.x)];
    const base = alongX ? 0 : Math.PI / 2, cars = [];
    for (let i = 0; i < 2; i++) {
      const off = (i ? 1 : -1) * 3.2;
      const x = alongX ? a : rl + off, z = alongX ? rl + off : a;
      const v = g.vehicles.spawn('police', x, z, base + (i ? 0.25 : -0.2), { driver: 'police' });
      if (!v) { this.blockDbg = 'spawn-failed'; break; }
      if (v.driver !== 'police') g.vehicles.enter?.(v, 'police');
      v.driver = 'police'; v.sirenOn = true;
      const e = { vehicle: v, state: 'parked', block: true, stuckT: 0, reverseT: 0, revSteer: 1, path: null, pathT: 0, lastHeading: v.heading, lastRaw: 0, totalStuck: 0, age: 0, leaveT: 0 };
      this.cars.push(e); cars.push(e);
    }
    if (cars.length < 2) { for (const c of cars) this._removeCar(c); this.blockTry++; return; }
    this.blockTry = 0; this.blockDbg = 'ok';
    this.block = { cars, fx: alongX ? s : 0, fz: alongX ? 0 : s };
    g.events?.emit('hud:message', { text: 'Roadblock ahead!', duration: 2 });
  }

  // ---------- cops on foot ----------
  _updateCop(c, dt, pp) {
    const L = this.wanted, ai = c.cop;
    const px = c.position.x, pz = c.position.z;
    const dx = pp.x - px, dz = pp.z - pz;
    const d = Math.hypot(dx, dz);
    const los = d < 70 && this.grid.lineClear(px, pz, pp.x, pp.z);
    ai.los = los;
    const armed = L >= 2;
    const aggro = L >= 4;
    const stopDist = aggro ? 9 : 15;

    let vx = 0, vz = 0, aim = null;
    const mv = this._mv;

    if (!armed) {
      // 1 star: run up and arrest
      if (d > 1.3) { this._chaseTarget(ai, px, pz, pp, los, d, dt); this._moveTo(px, pz, d > 12 ? 5.2 : 3.4); vx = mv.x; vz = mv.z; }
      aim = Math.atan2(dx, dz);
    } else if (los && d < stopDist) {
      aim = Math.atan2(dx, dz);
      ai.strafeT -= dt;
      if (ai.strafeT <= 0) { ai.strafeT = 1 + Math.random() * 2; ai.strafeDir = Math.random() < 0.5 ? -1 : 1; if (Math.random() < 0.3) ai.strafeDir = 0; }
      const nx = -dz / (d || 1), nz = dx / (d || 1);
      vx = nx * ai.strafeDir * 1.6; vz = nz * ai.strafeDir * 1.6;
      if (d < 5) { vx -= dx / d * 2; vz -= dz / d * 2; }
      else if (aggro && d > 8) { vx += dx / d * 1.8; vz += dz / d * 1.8; }
    } else {
      this._chaseTarget(ai, px, pz, pp, los, d, dt); this._moveTo(px, pz, 5.4); vx = mv.x; vz = mv.z;
      if (los) aim = Math.atan2(dx, dz);
    }

    // separation from other cops
    for (let i = 0; i < this.cops.length; i++) {
      const o = this.cops[i];
      if (o === c) continue;
      const sx = px - o.position.x, sz = pz - o.position.z, sd = Math.hypot(sx, sz);
      if (sd < 1.3 && sd > 0.01) { vx += sx / sd * 1.5; vz += sz / sd * 1.5; }
    }
    if (ai.leave) { ai.leaveT += dt; }
    c.cmd.vx = vx; c.cmd.vz = vz; c.aim = aim;

    // shooting
    ai.cd -= dt;
    if (armed && los && d < 48 && ai.cd <= 0) {
      ai.cd = SHOOT_CD[L] * (0.8 + Math.random() * 0.5);
      this._shoot(c, pp, d, L);
    }
  }

  // writes the velocity toward this._tgt into this._mv
  _moveTo(px, pz, speed) {
    const t = this._tgt, ddx = t.x - px, ddz = t.z - pz, dd = Math.hypot(ddx, ddz) || 1;
    this._mv.x = ddx / dd * speed; this._mv.z = ddz / dd * speed;
  }
  // writes the chase target (player or the next sidewalk waypoint) into this._tgt
  _chaseTarget(ai, px, pz, pp, los, d, dt) {
    const t = this._tgt;
    t.x = pp.x; t.z = pp.z;
    if (!los || d > 45) {
      ai.wpT = (ai.wpT || 0) - dt;
      if (ai.wp && (Math.hypot(ai.wp.x - px, ai.wp.z - pz) < 2.5 || ai.wpT <= 0)) ai.wp = null;
      if (!ai.wp) {
        const path = sidewalkPath(nearestNode(px, pz), nearestNode(pp.x, pp.z));
        let wp = null;
        if (path) for (let i = 0; i < path.length; i++) { const q = nodePos(path[i]); if (Math.hypot(q.x - px, q.z - pz) > 2.5) { wp = q; break; } }
        if (wp) { ai.wp = wp; ai.wpT = 8; }
      }
      if (ai.wp) { t.x = ai.wp.x; t.z = ai.wp.z; }
    } else ai.wp = null;
  }

  _shoot(c, pp, d, L) {
    const g = this.game, pv = g.player?.vehicle;
    const ox = c.position.x, oz = c.position.z;
    let chance = 0.22 + 0.06 * L - d * 0.004;
    if (pv && Math.abs(pv.speed) > 8) chance *= 0.45;
    chance = clamp(chance, 0.06, 0.6);
    const hit = Math.random() < chance;
    const ty = pv ? 1.0 : 1.1;
    let tx = pp.x, tz = pp.z;
    if (!hit) { tx += (Math.random() - 0.5) * 3; tz += (Math.random() - 0.5) * 3; }
    this._tracer(ox, 1.3, oz, tx, ty, tz);
    g.audio?.play?.('gunshot', { x: ox, z: oz });
    g.peds?.scare?.(ox, oz, 28);
    if (hit) g.player?.damage?.(SHOOT_DMG[L] + Math.floor(Math.random() * 3), 'police');
  }

  // ---------- tracers ----------
  _tracer(x0, y0, z0, x1, y1, z1) {
    const scene = this.game.scene;
    if (!scene) return;
    let t = null;
    for (let i = 0; i < this.tracers.length; i++) if (this.tracers[i].life <= 0) { t = this.tracers[i]; break; }
    if (!t) {
      if (this.tracers.length >= 16) return;
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 }));
      line.frustumCulled = false;
      scene.add(line);
      t = { line, life: 0 };
      this.tracers.push(t);
    }
    const a = t.line.geometry.attributes.position;
    a.setXYZ(0, x0, y0, z0); a.setXYZ(1, x1, y1, z1); a.needsUpdate = true;
    t.line.visible = true; t.life = 0.09;
  }
  _updateTracers(dt) {
    for (let i = 0; i < this.tracers.length; i++) { const t = this.tracers[i]; if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.line.visible = false; } }
  }

  // ---------- evasion & busting ----------
  _evasion(dt, pp) {
    let seen = false;
    for (let i = 0; i < this.cops.length; i++) {
      const c = this.cops[i];
      const d = Math.hypot(c.position.x - pp.x, c.position.z - pp.z);
      if (d < 80 && (c.cop?.los ?? this.grid.lineClear(c.position.x, c.position.z, pp.x, pp.z))) { seen = true; break; }
    }
    if (!seen) for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i];
      if (c.state === 'parked') continue;
      const p = c.vehicle.position, d = Math.hypot(p.x - pp.x, p.z - pp.z);
      if (d < 80 && this.grid.lineClear(p.x, p.z, pp.x, pp.z)) { seen = true; break; }
    }
    if (seen) { this.unseenT = 0; return; }
    this.unseenT += dt;
    if (this.unseenT >= FORGET_TIME) {
      this.unseenT = 0;
      this.heat = Math.max(0, Math.floor(this.heat + 1e-6) - 1);
      this._apply(Math.floor(this.heat + 1e-6));
    }
  }

  _busting(dt, pp) {
    const g = this.game;
    const ok = this.wanted >= 1 && this.wanted <= 2 && this.bustCd <= 0 && !g.player?.vehicle && this.pSpeed < 3 && g.player?.alive !== false;
    let near = false;
    if (ok) for (let i = 0; i < this.cops.length; i++) { const c = this.cops[i]; if (Math.hypot(c.position.x - pp.x, c.position.z - pp.z) < 2) { near = true; break; } }
    if (near) this.bustT += dt; else this.bustT = Math.max(0, this.bustT - dt * 2);
    if (this.bustT >= 3) {
      this.bustT = 0; this.bustCd = 6;
      g.events?.emit('player:busted', {});
      g.events?.emit('hud:bigtext', { text: 'BUSTED', color: '#39f', duration: 3 });
    }
  }

  // ---------- wanted == 0 cleanup ----------
  _updateLeaving(dt, pp) {
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const c = this.cops[i], ai = c.cop; ai.leaveT = (ai.leaveT || 0) + dt;
      const dx = c.position.x - pp.x, dz = c.position.z - pp.z, d = Math.hypot(dx, dz) || 1;
      c.cmd.vx = dx / d * 2.4; c.cmd.vz = dz / d * 2.4; c.aim = null;
      if (d > 110 || (ai.leaveT > 15 && !inView(this.game, c.position.x, c.position.z))) this._removeCop(c);
    }
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      c.leaveT += dt;
      const p = c.vehicle.position, dx = p.x - pp.x, dz = p.z - pp.z, d = Math.hypot(dx, dz) || 1;
      if (c.state === 'leave') {
        const k = this.heatLeaveTarget(c, pp);
        const o = this._opt; o.aggressive = false; o.slowNear = false; o.avoid = false;
        this._drive(c, dt, k.x, k.z, o);
        if (d > 140 || (c.leaveT > 25 && !inView(this.game, p.x, p.z))) this._removeCar(c);
      } else if (c.leaveT > 25 && d > 40 && !inView(this.game, p.x, p.z)) this._removeCar(c);
      else c.leaveT += 0;
    }
  }
  heatLeaveTarget(c, pp) {     // writes into a reused object
    const p = c.vehicle.position, t = this._lt;
    t.x = p.x + (p.x - pp.x); t.z = p.z + (p.z - pp.z);
    return t;
  }
}
