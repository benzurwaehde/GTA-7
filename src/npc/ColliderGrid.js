// Uniform grid over the static AABB colliders so per-ped / per-cop queries stay cheap.

// Allocation-free ray vs AABB in XZ (core/physics rayBox builds temporary arrays per call).
function rayBox(ox, oz, dx, dz, b) {
  let tmin = -Infinity, tmax = Infinity;
  if (Math.abs(dx) < 1e-9) { if (ox < b.minX || ox > b.maxX) return Infinity; }
  else {
    let t1 = (b.minX - ox) / dx, t2 = (b.maxX - ox) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
  }
  if (Math.abs(dz) < 1e-9) { if (oz < b.minZ || oz > b.maxZ) return Infinity; }
  else {
    let t1 = (b.minZ - oz) / dz, t2 = (b.maxZ - oz) / dz;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
  }
  return tmax >= Math.max(tmin, 0) ? Math.max(tmin, 0) : Infinity;
}

const CELL = 24;

export class ColliderGrid {
  constructor(game) {
    this.game = game;
    this.cells = new Map();
    this.count = -1;
    this.src = null;
    this.stamp = 0;
    this.out = [];
  }
  _rebuild(list) {
    this.cells.clear();
    this.src = list; this.count = list.length;
    for (const b of list) {
      if (b._gs === undefined) b._gs = 0;
      const x0 = Math.floor(b.minX / CELL), x1 = Math.floor(b.maxX / CELL);
      const z0 = Math.floor(b.minZ / CELL), z1 = Math.floor(b.maxZ / CELL);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const k = x * 4096 + z;
        let a = this.cells.get(k);
        if (!a) this.cells.set(k, a = []);
        a.push(b);
      }
    }
  }
  _sync() {
    const list = this.game.world?.colliders;
    if (!list) { this.cells.clear(); this.count = -1; return false; }
    if (list !== this.src || list.length !== this.count) this._rebuild(list);
    return true;
  }
  // Boxes overlapping the given XZ rectangle (array is reused between calls).
  query(minX, minZ, maxX, maxZ) {
    const out = this.out; out.length = 0;
    if (!this._sync()) return out;
    const st = ++this.stamp;
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const a = this.cells.get(x * 4096 + z);
      if (!a) continue;
      for (const b of a) if (b._gs !== st) { b._gs = st; out.push(b); }
    }
    return out;
  }
  near(x, z, r) { return this.query(x - r, z - r, x + r, z + r); }
  // True when nothing taller than minH blocks the XZ segment a->b.
  lineClear(ax, az, bx, bz, minH = 2.5) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return true;
    const boxes = this.query(Math.min(ax, bx) - 1, Math.min(az, bz) - 1, Math.max(ax, bx) + 1, Math.max(az, bz) + 1);
    const ux = dx / len, uz = dz / len;
    for (const b of boxes) {
      if (b.maxY !== undefined && b.maxY < minH) continue;
      if (rayBox(ax, az, ux, uz, b) < len) return false;
    }
    return true;
  }
}
