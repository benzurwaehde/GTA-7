// Street-AI: pedestrians (civilians + cop bodies used by the Police system).
import * as THREE from 'three';
import { resolveCircleVsBoxes, rayBox } from '../core/physics.js';
import { ColliderGrid } from './ColliderGrid.js';
import { buildPedMesh, billGeo, billMat } from './PedModel.js';
import { neighbors, nodePos, nodeKey, nearestNode, randomNodeAround } from './sidewalk.js';
import { inView, playerPos, wrapAngle } from './view.js';

const TARGET = 40;
const RECYCLE = 125;
const SPAWN_MIN = 30, SPAWN_MAX = 112;
const BODY_TIME = 25;

export class Pedestrians {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.pickups = [];
    this.grid = new ColliderGrid(game);
    this.target = TARGET;
    this.group = new THREE.Group();
    this.group.name = 'peds';
    game.scene?.add(this.group);
    this.firstFill = true;
    this.cullT = 0;
    this._id = 1;
    game.events?.on('weapon:fired', e => {
      const p = e?.position;
      if (p) this.scare(p.x, p.z, 40);
    });
    game.events?.on('player:respawn', () => { for (const p of this.list) if (p.state === 'flee') this._calm(p); });
  }

  get civilianCount() { let n = 0; for (const p of this.list) if (!p.isCop && p.alive) n++; return n; }

  // ---------- creation ----------
  _make(x, z, kind) {
    const mesh = buildPedMesh(kind);
    mesh.position.set(x, 0, z);
    const ped = {
      id: this._id++, mesh, position: mesh.position, heading: Math.random() * Math.PI * 2,
      health: 100, alive: true, state: 'walk', radius: 0.4, isCop: kind === 'cop',
      speed: 1.1 + Math.random() * 0.6, phase: Math.random() * 6, curSpeed: 0,
      from: null, to: null, tx: x, tz: z, jx: 0, jz: 0, fleeT: 0, fleeX: 0, fleeZ: 0,
      stuckT: 0, lx: x, lz: z, deadT: 0, vel: new THREE.Vector3(), fall: 0, fallDir: Math.random() < 0.5 ? 1 : -1,
      external: false, cmd: { vx: 0, vz: 0 }, aim: null,
    };
    mesh.rotation.y = ped.heading;
    this.group.add(mesh);
    this.list.push(ped);
    return ped;
  }

  spawnCop(x, z) {
    const p = this._make(x, z, 'cop');
    p.external = true; p.health = 100; p.speed = 3;
    return p;
  }

  removePed(ped) {
    const i = this.list.indexOf(ped);
    if (i >= 0) this.list.splice(i, 1);
    this.group.remove(ped.mesh);
  }

  _spawnCivilian(first) {
    const pp = playerPos(this.game);
    let n = null;
    for (let t = 0; t < 8 && !n; t++) {
      const c = randomNodeAround(pp.x, pp.z, first ? 8 : SPAWN_MIN, SPAWN_MAX, 6,
        (x, z) => !first && t < 6 && inView(this.game, x, z));
      if (c) n = c;
    }
    if (!n) return null;
    const nb = neighbors(n);
    if (!nb.length) return null;
    const m = nb[Math.floor(Math.random() * nb.length)].node;
    const a = nodePos(n), b = nodePos(m), f = Math.random();
    const ped = this._make(a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f, 'civ');
    ped.from = n; ped.to = m;
    this._jitter(ped);
    this._face(ped, b.x - a.x, b.z - a.z, true);
    return ped;
  }

  _jitter(ped) { ped.jx = (Math.random() - 0.5) * 1.6; ped.jz = (Math.random() - 0.5) * 1.6; }
  _face(ped, dx, dz, snap) {
    if (Math.abs(dx) + Math.abs(dz) < 1e-4) return;
    const want = Math.atan2(dx, dz);
    ped.heading = snap ? want : ped.heading + wrapAngle(want - ped.heading) * 0.2;
  }

  // ---------- API ----------
  scare(x, z, radius = 40) {
    for (const p of this.list) {
      if (!p.alive || p.isCop) continue;
      const dx = p.position.x - x, dz = p.position.z - z;
      if (dx * dx + dz * dz > radius * radius) continue;
      p.state = 'flee'; p.fleeX = x; p.fleeZ = z;
      p.fleeT = 5 + Math.random() * 6;
    }
  }

  hitTest(origin, dir, maxDist) {
    const dl = Math.hypot(dir.x, dir.z);
    if (dl < 1e-6) return null;
    const ux = dir.x / dl, uz = dir.z / dl;
    let best = null;
    for (const p of this.list) {
      if (!p.alive) continue;
      const rx = p.position.x - origin.x, rz = p.position.z - origin.z;
      const along = rx * ux + rz * uz;
      if (along < -0.3 || along > maxDist * dl + 1) continue;
      const perp2 = rx * rx + rz * rz - along * along;
      const r = p.radius + 0.1;
      if (perp2 > r * r) continue;
      const t2 = along - Math.sqrt(Math.max(0, r * r - perp2));
      const t = Math.max(0, t2) / dl;
      if (t > maxDist) continue;
      const y = origin.y + dir.y * t;
      if (y < p.position.y - 0.05 || y > p.position.y + 1.85) continue;
      if (!best || t < best.dist) best = { ped: p, dist: t };
    }
    if (!best) return null;
    // line of sight vs static colliders
    const cols = this.game.world?.colliders;
    if (cols) {
      const ox = origin.x, oz = origin.z;
      for (const b of this.grid.query(Math.min(ox, ox + ux * best.dist * dl) - 1, Math.min(oz, oz + uz * best.dist * dl) - 1,
        Math.max(ox, ox + ux * best.dist * dl) + 1, Math.max(oz, oz + uz * best.dist * dl) + 1)) {
        const tb = rayBox(ox, oz, ux, uz, b);
        if (tb / dl < best.dist - 0.1 && (b.maxY === undefined || origin.y + dir.y * (tb / dl) < b.maxY)) return null;
      }
    }
    best.point = new THREE.Vector3().copy(origin).addScaledVector(dir, best.dist);
    return best;
  }

  damage(ped, amount, source = 'player') {
    if (!ped || !ped.alive) return false;
    ped.health -= amount;
    this.game.events?.emit('ped:damaged', { ped, amount, source });
    if (ped.health <= 0) {
      const pp = playerPos(this.game);
      let ix = ped.position.x - pp.x, iz = ped.position.z - pp.z;
      const l = Math.hypot(ix, iz) || 1;
      this.kill(ped, source, ix / l * 3, 3, iz / l * 3);
      return true;
    }
    if (!ped.isCop) {
      const pp = playerPos(this.game);
      ped.state = 'flee'; ped.fleeT = 8;
      ped.fleeX = source === 'player' ? pp.x : ped.position.x - 1; ped.fleeZ = source === 'player' ? pp.z : ped.position.z;
    }
    return false;
  }

  kill(ped, source, vx = 0, vy = 3, vz = 0) {
    if (!ped.alive) return;
    ped.alive = false; ped.health = 0; ped.state = 'dead'; ped.deadT = 0;
    ped.vel.set(vx, vy, vz);
    ped.cmd.vx = ped.cmd.vz = 0;
    this.game.events?.emit('ped:killed', { ped, source });
    if (Math.random() < (ped.isCop ? 0.25 : 0.4)) this._dropCash(ped.position.x, ped.position.z);
  }

  _dropCash(x, z) {
    const m = new THREE.Mesh(billGeo, billMat);
    m.position.set(x, 0.55, z);
    this.group.add(m);
    this.pickups.push({ mesh: m, t: 0, amount: 20 + Math.floor(Math.random() * 130) });
    if (this.pickups.length > 24) { const o = this.pickups.shift(); this.group.remove(o.mesh); }
  }

  // ---------- update ----------
  update(dt) {
    const g = this.game;
    const pp = playerPos(g);

    // population management
    this.cullT -= dt;
    if (this.cullT <= 0) {
      this.cullT = 0.5;
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        if (p.isCop) continue;
        const dx = p.position.x - pp.x, dz = p.position.z - pp.z;
        if (dx * dx + dz * dz > RECYCLE * RECYCLE) this.removePed(p);
      }
    }
    let spawned = 0, need = this.target - this.civilianCount;
    while (need > 0 && spawned < (this.firstFill ? 60 : 2)) {
      if (!this._spawnCivilian(this.firstFill)) break;
      spawned++; need--;
    }
    if (need <= 0) this.firstFill = false;

    const vehicles = g.vehicles?.list || [];
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (p.state === 'dead') { this._updateDead(p, dt); if (p.deadT > BODY_TIME) this.removePed(p); continue; }
      if (p.external) this._moveExternal(p, dt);
      else if (p.state === 'flee') this._moveFlee(p, dt);
      else this._moveWalk(p, dt);
      this._animate(p, dt);
      // run over
      for (const v of vehicles) {
        if (v.destroyed || Math.abs(v.speed) <= 4 || !v.position) continue;
        const r = (v.radius ?? 1.8) * 0.9 + p.radius;
        const dx = p.position.x - v.position.x, dz = p.position.z - v.position.z;
        if (dx * dx + dz * dz < r * r) {
          const s = Math.sign(v.speed), sp = Math.min(Math.abs(v.speed), 25);
          this.kill(p, v.driver === 'player' ? 'player' : 'vehicle',
            Math.sin(v.heading) * s * sp * 0.7 + dx * 0.5, 3 + sp * 0.15, Math.cos(v.heading) * s * sp * 0.7 + dz * 0.5);
          break;
        }
      }
    }
    this._updatePickups(dt, pp);
  }

  _collide(p) {
    const boxes = this.grid.near(p.position.x, p.position.z, 1.5);
    if (boxes.length) resolveCircleVsBoxes(p.position, p.radius, boxes);
  }

  _moveWalk(p, dt) {
    if (!p.to) { const n = nearestNode(p.position.x, p.position.z); p.to = n; p.from = null; this._jitter(p); }
    const t = nodePos(p.to);
    const tx = t.x + p.jx, tz = t.z + p.jz;
    const dx = tx - p.position.x, dz = tz - p.position.z;
    const d = Math.hypot(dx, dz);
    p.curSpeed = p.speed;
    if (d < 1.0) { this._pickNext(p); }
    else {
      const sp = p.speed;
      p.position.x += dx / d * sp * dt; p.position.z += dz / d * sp * dt;
      this._face(p, dx, dz);
      p.curSpeed = sp;
    }
    this._collide(p);
    this._stuck(p, dt);
  }

  _pickNext(p) {
    const opts = neighbors(p.to);
    const fk = p.from ? nodeKey(p.from) : -1;
    let cand = opts.filter(o => nodeKey(o.node) !== fk);
    if (!cand.length) cand = opts;
    let tot = 0; for (const o of cand) tot += o.cross ? 0.5 : 1;
    let r = Math.random() * tot, pick = cand[0];
    for (const o of cand) { r -= o.cross ? 0.5 : 1; if (r <= 0) { pick = o; break; } }
    p.from = p.to; p.to = pick.node; this._jitter(p);
  }

  _stuck(p, dt) {
    p.stuckT += dt;
    if (p.stuckT >= 1.5) {
      const moved = Math.hypot(p.position.x - p.lx, p.position.z - p.lz);
      if (moved < p.speed * 1.5 * 0.25) {
        // turn around / re-route
        const old = p.from; p.from = p.to; p.to = old || nearestNode(p.position.x, p.position.z); this._jitter(p);
      }
      p.stuckT = 0; p.lx = p.position.x; p.lz = p.position.z;
    }
  }

  _moveFlee(p, dt) {
    p.fleeT -= dt;
    let dx = p.position.x - p.fleeX, dz = p.position.z - p.fleeZ;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    // slight wobble so crowds do not move in a perfect line
    const w = Math.sin(this.game.time * 3 + p.id) * 0.35;
    const fx = dx - dz * w, fz = dz + dx * w;
    const sp = 5.3;
    p.position.x += fx * sp * dt; p.position.z += fz * sp * dt;
    p.curSpeed = sp;
    this._face(p, fx, fz);
    const bx = p.position.x, bz = p.position.z;
    this._collide(p);
    // if a wall blocked us, slide along it by choosing a new run direction
    if (Math.hypot(p.position.x - bx, p.position.z - bz) > 0.05) { p.fleeX = p.position.x - dz * 5 - dx * 2; p.fleeZ = p.position.z + dx * 5 - dz * 2; }
    if (p.fleeT <= 0) this._calm(p);
  }

  _calm(p) {
    p.state = 'walk';
    p.to = nearestNode(p.position.x, p.position.z); p.from = null; this._jitter(p);
  }

  _moveExternal(p, dt) {
    const { vx, vz } = p.cmd;
    const sp = Math.hypot(vx, vz);
    p.position.x += vx * dt; p.position.z += vz * dt;
    p.curSpeed = sp;
    if (p.aim !== null && p.aim !== undefined) p.heading += wrapAngle(p.aim - p.heading) * Math.min(1, dt * 10);
    else if (sp > 0.2) this._face(p, vx, vz);
    this._collide(p);
  }

  _animate(p, dt) {
    const sp = p.curSpeed;
    p.phase += dt * (2 + sp * 1.7);
    const amp = Math.min(0.9, 0.25 + sp * 0.12) * Math.min(1, sp / 0.8);
    const u = p.mesh.userData;
    u.legL.rotation.x = Math.sin(p.phase) * amp;
    u.legR.rotation.x = -Math.sin(p.phase) * amp;
    u.torso.rotation.z = Math.sin(p.phase) * 0.04 * Math.min(1, sp);
    p.mesh.rotation.y = p.heading;
    p.curSpeed *= 0.0; // re-set each frame by the movers
  }

  _updateDead(p, dt) {
    p.deadT += dt;
    const pos = p.position;
    if (pos.y > 0.14 || p.vel.y > 0) {
      pos.x += p.vel.x * dt; pos.z += p.vel.z * dt; pos.y += p.vel.y * dt;
      p.vel.y -= 22 * dt;
      if (pos.y <= 0.14) { pos.y = 0.14; p.vel.set(p.vel.x * 0.4, 0, p.vel.z * 0.4); }
      this._collide(p);
    } else if (p.vel.x * p.vel.x + p.vel.z * p.vel.z > 0.01) {
      pos.x += p.vel.x * dt; pos.z += p.vel.z * dt;
      const f = Math.max(0, 1 - 4 * dt); p.vel.x *= f; p.vel.z *= f;
      this._collide(p);
    }
    p.fall = Math.min(1, p.fall + dt * 3);
    p.mesh.rotation.x = -p.fall * (Math.PI / 2) * p.fallDir;
    p.mesh.rotation.y = p.heading;
    const u = p.mesh.userData;
    u.legL.rotation.x *= 0.9; u.legR.rotation.x *= 0.9;
    if (p.deadT > BODY_TIME - 2) pos.y -= dt * 0.12;
  }

  _updatePickups(dt, pp) {
    if (!this.pickups.length) return;
    const g = this.game;
    const veh = g.player?.vehicle;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      k.t += dt;
      k.mesh.rotation.y += dt * 3;
      k.mesh.position.y = 0.55 + Math.sin(k.t * 3) * 0.08;
      let hit = false;
      const dx = k.mesh.position.x - pp.x, dz = k.mesh.position.z - pp.z;
      if (g.player && dx * dx + dz * dz < (veh ? ((veh.radius ?? 1.8) + 0.8) ** 2 : 1.5 * 1.5)) hit = true;
      if (hit) {
        g.state.money = (g.state.money || 0) + k.amount;
        g.events?.emit('money:changed', { money: g.state.money, delta: k.amount });
        g.audio?.play?.('pickup');
        g.events?.emit('hud:message', { text: `+$${k.amount}`, duration: 1.2 });
      }
      if (hit || k.t > 60) { this.group.remove(k.mesh); this.pickups.splice(i, 1); }
    }
  }
}
