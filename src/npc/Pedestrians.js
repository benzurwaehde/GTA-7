// Street-AI: pedestrians (civilians + cop bodies used by the Police system).
import * as THREE from 'three';
import { resolveCircleVsBoxes, rayBox } from '../core/physics.js';
import { ColliderGrid } from './ColliderGrid.js';
import { buildPedMesh, releasePedMesh, billGeo, billMat } from './PedModel.js';
import { neighbors, nodePos, nodeKey, nearestNode, randomNodeAround } from './sidewalk.js';
import { inView, playerPos, wrapAngle } from './view.js';
import { Ragdoll } from '../characters/Ragdoll.js';
import { Blood } from '../characters/Blood.js';
import { setSurfaceWorld, surfaceY } from '../characters/surface.js';

const TARGET = 40;
const RECYCLE = 125;
const SPAWN_MIN = 30, SPAWN_MAX = 112;
const BODY_TIME = 25;
const FIGHT_CHANCE = 0.15;   // share of civilians that hit back
const CAR_CLEAR = 15;        // fallback: no moving car within this distance of the crossing
const _mid = { x: 0, z: 0 };
const MAX_RAGDOLLS = 8;      // active ragdolls; older ones freeze in their pose
const LOD_NEAR = 50, LOD_FAR = 100;
const WALK_REF = 1.65, RUN_REF = 3.6;   // m/s the clips travel at timeScale 1 (foot contact speed measured in Blender)
const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sph = new THREE.Sphere(), _hv = new THREE.Vector3(), _hd = new THREE.Vector3();

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
    this.blood = new Blood(game.scene);
    if (!game.blood) game.blood = this.blood;     // shared with other systems (e.g. impact effects)
    this.ragdolls = [];                           // active Ragdoll instances, oldest first
    this.frame = 0;
    this.blast = { x: 0, y: 0, z: 0, radius: 0, t: -99 };   // last explosion, for the direction/strength of body impulses
    game.events?.on('explosion', e => {
      if (e && Number.isFinite(e.x)) { this.blast.x = e.x; this.blast.y = e.y || 0; this.blast.z = e.z; this.blast.radius = e.radius || 8; this.blast.t = this.game.time; }
    });
    this.useRagdoll = true;                       // false = death clip only (fallback)
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
      human: mesh.userData?.human || null, ragdoll: null, puddled: false, lod: 0, lodDt: 0, deathVariant: 0, hurtT: 0,
      external: false, cmd: { vx: 0, vz: 0 }, aim: null,
      fighter: kind !== 'cop' && Math.random() < FIGHT_CHANCE, fightT: 0, punchCd: 0, punchAnim: 0, waiting: null, waitT: 0,
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
    if (ped.ragdoll) { const k = this.ragdolls.indexOf(ped.ragdoll); if (k >= 0) this.ragdolls.splice(k, 1); ped.ragdoll = null; }
    this.group.remove(ped.mesh);
    releasePedMesh(ped.mesh);
    ped.human = null;
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
      if (p.state === 'fight') continue;
      p.waiting = null;
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

  // hit (optional): { point: Vector3, dir: Vector3 } for blood placement and flinch direction.
  damage(ped, amount, source = 'player', hit = null) {
    if (!ped || !ped.alive) return false;
    ped.health -= amount;
    this._hitFx(ped, amount, hit);
    this.game.events?.emit('ped:damaged', { ped, amount, source });
    if (ped.health <= 0) {
      const pp = playerPos(this.game);
      let ix = hit?.dir ? hit.dir.x : ped.position.x - pp.x, iz = hit?.dir ? hit.dir.z : ped.position.z - pp.z;
      let sp = 4.5, up = 3;
      const b = this._blastFor(ped, source);
      if (b) {   // explosion: away from the centre, stronger and higher the closer the body is
        ix = ped.position.x - b.x; iz = ped.position.z - b.z;
        const k = Math.max(0, Math.min(1, 1 - Math.hypot(ix, iz) / (b.radius * 1.2)));
        sp = 6 + 14 * k; up = 4 + 6 * k;
      }
      const l = Math.hypot(ix, iz) || 1;
      this.kill(ped, source, ix / l * sp, up, iz / l * sp);
      return true;
    }
    if (!ped.isCop) {
      const pp = playerPos(this.game);
      if (ped.fighter && source === 'player' && this._canFight(ped)) {
        ped.state = 'fight'; ped.fightT = 14; ped.waiting = null; ped.punchCd = 0.5;
        return false;
      }
      ped.waiting = null;
      ped.state = 'flee'; ped.fleeT = 8;
      ped.fleeX = source === 'player' ? pp.x : ped.position.x - 1; ped.fleeZ = source === 'player' ? pp.z : ped.position.z;
    }
    return false;
  }

  // Recent explosion that hurt this ped: the 'explosion' event (grenades), or the nearest freshly blown-up car/helicopter.
  _blastFor(ped, source) {
    const b = this.blast, g = this.game;
    if (g.time - b.t < 0.3 && Math.hypot(ped.position.x - b.x, ped.position.z - b.z) < b.radius * 1.3) return b;
    if (source !== 'explosion') return null;
    let best = null, bd = 12;
    for (const v of g.vehicles?.list || []) {
      if (!v.destroyed || !(v.burnT > 15)) continue;           // burnT is set to 16 when a car blows up
      const d = Math.hypot(ped.position.x - v.position.x, ped.position.z - v.position.z);
      if (d < bd) { bd = d; best = v; }
    }
    if (!best) return null;
    b.x = best.position.x; b.z = best.position.z; b.radius = 8; b.t = g.time;
    return b;
  }

  // Blood spray + short flinch for every hit. Shot direction comes from `hit`, else away from the player.
  _hitFx(ped, amount, hit) {
    const pp = playerPos(this.game);
    if (hit?.dir) _hd.copy(hit.dir); else _hd.set(ped.position.x - pp.x, 0, ped.position.z - pp.z);
    _hd.y = 0; if (_hd.lengthSq() < 1e-6) _hd.set(0, 0, 1); _hd.normalize();
    if (hit?.point) _hv.copy(hit.point); else _hv.set(ped.position.x, ped.position.y + 1.25, ped.position.z);
    this.blood.spray(_hv, _hd, amount >= 30 ? 16 : 9, 3.2);
    ped.human?.flinch(_hd.x, _hd.z, amount >= 30 ? 1 : 0.7);
    ped.hurtT = 0.4;
  }

  // Fighters only brawl with an unarmed player on foot.
  _canFight(ped) {
    const pl = this.game.player;
    return !!pl && !pl.vehicle && pl.alive !== false && (!pl.weapon?.id || pl.weapon.id === 'fists');
  }

  kill(ped, source, vx = 0, vy = 3, vz = 0) {
    if (!ped.alive) return;
    ped.alive = false; ped.health = 0; ped.state = 'dead'; ped.deadT = 0;
    ped.vel.set(vx, vy, vz);
    ped.cmd.vx = ped.cmd.vz = 0;
    if (ped.human) this._startRagdoll(ped, vx, vy, vz);
    this.game.events?.emit('ped:killed', { ped, source });
    if (Math.random() < (ped.isCop ? 0.25 : 0.4)) this._dropCash(ped.position.x, ped.position.z);
  }

  _startRagdoll(ped, vx, vy, vz) {
    const h = ped.human;
    ped.position = ped.position.clone();           // the mesh stays where the body fell; the particles do the moving
    h.mesh.frustumCulled = false;
    h.aimW = 0;
    try {
      if (!this.useRagdoll) throw new Error('ragdoll off');
      const rd = new Ragdoll(h, this.grid);
      rd.impulse(vx, vy + 1.2, vz, 1.5);
      while (this.ragdolls.length >= MAX_RAGDOLLS) this.ragdolls.shift().freeze();
      this.ragdolls.push(rd); ped.ragdoll = rd;
      h.mixer.stopAllAction();
    } catch (e) {
      // fallback: death clip facing the hit direction
      ped.ragdoll = null;
      ped.heading = Math.atan2(vx, vz);                       // the clip falls forward, so face the way the body should go
      if (Math.random() < 0.5) h.model.scale.x *= -1;          // mirrored variant = second death animation
      h.play('death', { fade: 0.05 });
    }
    this.blood.spray(_hv.set(ped.position.x, ped.position.y + 1.2, ped.position.z), _hd.set(vx, 0, vz).normalize(), 10, 2.5);
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

    this.frame++;
    setSurfaceWorld(g.world);
    const cam = g.camera;
    if (cam) { cam.updateMatrixWorld?.(); _pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm); }
    for (let i = this.ragdolls.length - 1; i >= 0; i--) if (!this.ragdolls[i].update(dt)) this.ragdolls.splice(i, 1);
    this.blood.update(dt);
    const vehicles = g.vehicles?.list || [];
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (p.state === 'dead') { this._updateDead(p, dt); if (p.deadT > BODY_TIME) this.removePed(p); continue; }
      if (p.external) this._moveExternal(p, dt);
      else if (p.state === 'flee') this._moveFlee(p, dt);
      else if (p.state === 'fight') this._moveFight(p, dt, pp);
      else this._moveWalk(p, dt);
      this._animate(p, dt, pp);
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
    if (p.waiting) {
      p.curSpeed = 0; p.waitT += dt; p.stuckT = 0; p.lx = p.position.x; p.lz = p.position.z;
      if (this._crossingClear(p, tx, tz)) p.waiting = null;
      return;
    }
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
    // crossing a road at a corner: wait for the light (or a gap in traffic)
    p.waiting = pick.cross ? (pick.node.ix === p.from.ix && pick.node.sx !== p.from.sx ? 'ns' : 'ew') : null;
    p.waitT = 0;
  }

  // Traffic on axis 'ns' runs along Z (peds cross it walking along X), 'ew' along X.
  _crossingClear(p, tx, tz) {
    const g = this.game;
    _mid.x = (p.position.x + tx) / 2; _mid.z = (p.position.z + tz) / 2;
    const sig = g.world?.signalAt?.(_mid.x, _mid.z, p.waiting);
    const list = g.vehicles?.list;
    if (sig === 'red') {
      // the last cars may still be clearing the junction
      if (list) for (const v of list) {
        if (v.destroyed || !v.position || Math.abs(v.speed) < 3) continue;
        if (Math.hypot(v.position.x - _mid.x, v.position.z - _mid.z) < 6) return false;
      }
      return true;
    }
    if (sig === 'green' || sig === 'yellow') return false;
    // no signal available: wait until no moving car is within CAR_CLEAR of the crossing
    if (list) for (const v of list) {
      if (v.destroyed || !v.position || Math.abs(v.speed) < 1) continue;
      if (Math.hypot(v.position.x - _mid.x, v.position.z - _mid.z) < CAR_CLEAR) return false;
    }
    return true;
  }

  _moveFight(p, dt, pp) {
    const g = this.game;
    p.fightT -= dt; p.punchCd -= dt;
    if (p.fightT <= 0 || !this._canFight(p)) { this._beginFlee(p, pp); return; }
    const dx = pp.x - p.position.x, dz = pp.z - p.position.z, d = Math.hypot(dx, dz) || 1;
    if (d > 28) { this._calm(p); return; }
    p.curSpeed = 0;
    this._face(p, dx, dz);
    if (d > 1.15) {
      const sp = 3.6;
      p.position.x += dx / d * sp * dt; p.position.z += dz / d * sp * dt;
      p.curSpeed = sp;
    } else if (p.punchCd <= 0) {
      p.punchCd = 1.0 + Math.random() * 0.4; p.punchAnim = 1;
      g.audio?.play?.('punch', { x: p.position.x, z: p.position.z });
      g.player?.damage?.(5 + Math.floor(Math.random() * 4), 'ped');
    }
    this._collide(p);
  }

  _beginFlee(p, pp) {
    p.state = 'flee'; p.fleeT = 6; p.fleeX = pp.x; p.fleeZ = pp.z;
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
    p.state = 'walk'; p.waiting = null;
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

  _animate(p, dt, pp) {
    const sp = p.curSpeed;
    const h = p.human;
    p.mesh.rotation.y = p.heading;
    if (h) {
      // LOD: far peds update their skeleton less often, off-screen ones hardly at all
      const dx = p.position.x - pp.x, dz = p.position.z - pp.z, d2 = dx * dx + dz * dz;
      p.lodDt += dt;
      let every = 1;
      if (d2 > LOD_FAR * LOD_FAR) every = 8;
      else if (d2 > LOD_NEAR * LOD_NEAR) every = 3;
      _sph.center.set(p.position.x, 1, p.position.z); _sph.radius = 1.6;
      if (d2 > 144 && this.game.camera && !_fr.intersectsSphere(_sph)) every = Math.max(every, 6);
      p.curSpeed = 0;
      if ((this.frame + p.id) % every !== 0 && h.currentName) return;
      const adt = Math.min(p.lodDt, 0.25); p.lodDt = 0;
      if (p.punchAnim > 0) {
        if (h.currentName !== 'punch') h.play('punch', { fade: 0.08, restart: true, speed: 1.4 });
        p.punchAnim = Math.max(0, p.punchAnim - adt * 3.5);
      } else if (sp > 3.2 || p.state === 'flee') {
        h.play('run', { fade: 0.2, speed: p.state === 'flee' ? 1.3 : Math.max(0.8, sp / RUN_REF) });
      } else if (sp > 0.25) h.play('walk', { fade: 0.25, speed: Math.max(0.6, sp / WALK_REF) });
      else h.play('idle', { fade: 0.3 });
      h.model.position.y = surfaceY(p.position.x, p.position.z);   // feet on the slab / road, not inside it
      h.update(adt);
      return;
    }
    p.phase += dt * (2 + sp * 1.7);
    const amp = Math.min(0.9, 0.25 + sp * 0.12) * Math.min(1, sp / 0.8);
    const u = p.mesh.userData;
    u.legL.rotation.x = Math.sin(p.phase) * amp;
    u.legR.rotation.x = -Math.sin(p.phase) * amp;
    // arms swing against the legs; running pumps them harder, a punch overrides the right arm
    const aamp = amp * (p.state === 'flee' ? 1.15 : 0.8);
    u.armL.rotation.x = -Math.sin(p.phase) * aamp;
    u.armR.rotation.x = Math.sin(p.phase) * aamp;
    if (p.punchAnim > 0) {
      p.punchAnim = Math.max(0, p.punchAnim - dt * 3.5);
      u.armR.rotation.x = -Math.sin((1 - p.punchAnim) * Math.PI) * 1.9;
    }
    u.torso.rotation.z = Math.sin(p.phase) * 0.04 * Math.min(1, sp);
    p.curSpeed *= 0.0; // re-set each frame by the movers
  }

  _updateDead(p, dt) {
    p.deadT += dt;
    const h = p.human;
    if (h) {
      // ragdoll runs in update(); fallback clip plays here
      if (!p.ragdoll && h.currentName === 'death') h.update(dt);
      else if (p.ragdoll && !p.ragdoll.frozen && !p.puddled && p.deadT > 1.2) { /* wait for rest */ }
      if (!p.puddled && (p.deadT > 2.2 || (p.ragdoll && p.ragdoll.frozen))) {
        p.puddled = true;
        if (p.ragdoll) { p.ragdoll.pelvis(_hv); this.blood.puddle(_hv.x, _hv.z, 1.0 + Math.random() * 0.5); }
        else this.blood.puddle(p.position.x, p.position.z, 1.0 + Math.random() * 0.4);
      }
      if (p.deadT > BODY_TIME - 2) p.mesh.position.y -= dt * 0.12;
      return;
    }
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
    u.legL.rotation.x *= 0.9; u.legR.rotation.x *= 0.9; u.armL.rotation.x *= 0.9; u.armR.rotation.x *= 0.9;
    if (p.deadT > BODY_TIME - 2) pos.y -= dt * 0.12;
    if (!p.puddled && p.deadT > 1.2) { p.puddled = true; this.blood.puddle(pos.x, pos.z, 1.0 + Math.random() * 0.4); }
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
