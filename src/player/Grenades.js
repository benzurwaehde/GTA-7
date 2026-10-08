import * as THREE from 'three';
import { getModel } from '../core/assets.js';
import { resolveCircleVsBoxes, rayBox } from '../core/physics.js';

const MAX = 6, GRAVITY = 17, FUSE = 2.8, RADIUS = 9, R_BODY = 0.1;
const _near = []; // reused list of colliders around a grenade (no per-frame allocation)

// True if a building / wall stands between the blast (ox,oy,oz) and the target (tx,ty,tz). Allocation-free.
function blocked(cols, ox, oy, oz, tx, ty, tz) {
  if (!cols) return false;
  const dx = tx - ox, dz = tz - oz, l = Math.hypot(dx, dz);
  if (l < 0.5) return false;
  const ux = dx / l, uz = dz / l;
  for (let i = 0; i < cols.length; i++) {
    const b = cols[i];
    if (b.invisible) continue;
    const t = rayBox(ox, oz, ux, uz, b);
    if (t === Infinity || t < 0.02 || t >= l) continue; // miss, origin inside the box, or box behind the target
    if (oy + (ty - oy) * (t / l) < (b.maxY ?? 100)) return true;
  }
  return false;
}

// Thrown grenades: arc, bounce off ground and walls, fuse, explosion with damage in a radius.
export class Grenades {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group(); this.group.name = 'grenades'; game.scene.add(this.group);
    this.list = [];
    const proto = getModel('weapon_grenade');
    for (let i = 0; i < MAX; i++) {
      let m = proto ? (i === 0 ? proto : getModel('weapon_grenade')) : new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2f4a1a }));
      m.scale.setScalar(1.6); m.visible = false; this.group.add(m);
      this.list.push({ mesh: m, active: false, vel: new THREE.Vector3(), t: 0, spin: new THREE.Vector3(), bounceT: 0 });
    }
  }

  // Throw a grenade from `from` with velocity `vel` (m/s).
  throw(from, vel) {
    const g = this.list.find(o => !o.active) || this.list[0];
    g.active = true; g.t = 0; g.bounceT = 0;
    g.mesh.position.copy(from); g.vel.copy(vel); g.mesh.visible = true;
    g.spin.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
    return g;
  }

  update(dt) {
    const world = this.game.world, cols = world?.colliders;
    for (let k = 0; k < this.list.length; k++) {
      const o = this.list[k]; if (!o.active) continue;
      o.t += dt; o.bounceT -= dt;
      const p = o.mesh.position, v = o.vel;
      v.y -= GRAVITY * dt;
      p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
      o.mesh.rotation.x += o.spin.x * dt; o.mesh.rotation.z += o.spin.z * dt;
      let bounced = false;
      // ground
      if (p.y < R_BODY) {
        p.y = R_BODY;
        if (v.y < -1.2) { v.y *= -0.38; bounced = true; } else v.y = 0;
        const f = Math.exp(-dt * (v.y === 0 ? 5 : 1.5)); v.x *= f; v.z *= f; o.spin.multiplyScalar(0.9);
      }
      // walls (only boxes within a few metres, below their roof)
      if (cols) {
        _near.length = 0;
        for (let i = 0; i < cols.length; i++) {
          const b = cols[i];
          if (p.x > b.minX - 1 && p.x < b.maxX + 1 && p.z > b.minZ - 1 && p.z < b.maxZ + 1 && p.y < (b.maxY ?? 100)) _near.push(b);
        }
        if (_near.length) {
          const hit = resolveCircleVsBoxes(p, R_BODY, _near);
          if (hit) {
            const vn = v.x * hit.nx + v.z * hit.nz;
            if (vn < 0) { v.x -= 1.5 * vn * hit.nx; v.z -= 1.5 * vn * hit.nz; if (vn < -1.5) bounced = true; }
          }
        }
      }
      if (bounced && o.bounceT <= 0) { o.bounceT = 0.12; this.game.audio?.play?.('bounce', { x: p.x, z: p.z }); }
      if (o.t >= FUSE) this.explode(o);
    }
  }

  explode(o) {
    o.active = false; o.mesh.visible = false;
    const g = this.game, p = o.mesh.position, x = p.x, y = Math.max(0, p.y - 0.1), z = p.z, cols = g.world?.colliders, by = y + 0.5;
    g.vehicles?.effects?.explosion?.(x, y, z);
    g.audio?.play?.('explosion', { x, z });
    g.events.emit('explosion', { x, y, z, radius: RADIUS, source: 'grenade' });
    // peds / cops
    const peds = g.peds?.list;
    if (peds) for (let i = peds.length - 1; i >= 0; i--) {
      const q = peds[i]; if (!q?.position || q.alive === false || q.state === 'dead') continue;
      const d = Math.hypot(q.position.x - x, q.position.z - z);
      if (d < RADIUS && !blocked(cols, x, by, z, q.position.x, 1, q.position.z)) g.peds.damage?.(q, 160 * (1 - d / RADIUS) + 30, 'player');
    }
    // cars: shove + damage (a destroyed car explodes by itself)
    const cars = g.vehicles?.list;
    if (cars) for (let i = cars.length - 1; i >= 0; i--) {
      const v = cars[i]; if (!v?.position || v.destroyed) continue;
      const dx = v.position.x - x, dz = v.position.z - z, d = Math.hypot(dx, dz);
      if (d < RADIUS + 1.5 && !blocked(cols, x, by, z, v.position.x, 0.8, v.position.z)) {
        const k = 1 - d / (RADIUS + 1.5);
        if (v.vx !== undefined) { const inv = 1 / (d || 1); v.vx += dx * inv * 6 * k; v.vz += dz * inv * 6 * k; v.sleeping = false; }
        g.vehicles.damage?.(v, 70 * k + 8);
      }
    }
    // police helicopter (T4): distance falloff handled by the helicopter itself
    g.police?.helicopter?.blast?.(x, y, z, RADIUS + 3, 120);
    // the player (walls shield the player)
    const pl = g.player;
    if (pl?.alive && pl.position) {
      const d = Math.hypot(pl.position.x - x, pl.position.z - z);
      if (d < RADIUS && !blocked(cols, x, by, z, pl.position.x, pl.position.y + 1, pl.position.z)) pl.damage?.(80 * (1 - d / RADIUS), 'explosion');
      if (d < 40) pl.cam?.shake?.(Math.min(1, 1.2 * (1 - d / 40)));
    }
  }
}
