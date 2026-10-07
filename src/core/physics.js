// Minimal 2D (XZ-plane) collision helpers shared by all teams.
// Static colliders are axis-aligned boxes: { minX, maxX, minZ, maxZ }.

// Push a circle (x,z,r) out of every overlapping AABB. Mutates and returns pos; returns hit normal info.
export function resolveCircleVsBoxes(pos, r, boxes) {
  let hit = null;
  for (const b of boxes) {
    const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2), push = r - d;
      pos.x += (dx / d) * push; pos.z += (dz / d) * push;
      hit = { nx: dx / d, nz: dz / d };
    } else { // center inside box: push out along smallest axis
      const opts = [[pos.x - b.minX + r, -1, 0], [b.maxX - pos.x + r, 1, 0], [pos.z - b.minZ + r, 0, -1], [b.maxZ - pos.z + r, 0, 1]];
      opts.sort((a, c) => a[0] - c[0]);
      const [amt, nx, nz] = opts[0];
      pos.x += nx * amt; pos.z += nz * amt;
      hit = { nx, nz };
    }
  }
  return hit;
}

export function circlesOverlap(ax, az, ar, bx, bz, br) {
  const dx = ax - bx, dz = az - bz, rr = ar + br;
  return dx * dx + dz * dz < rr * rr;
}

// Ray (2D) vs AABB: returns distance t or Infinity.
export function rayBox(ox, oz, dx, dz, b) {
  let tmin = -Infinity, tmax = Infinity;
  for (const [o, d, lo, hi] of [[ox, dx, b.minX, b.maxX], [oz, dz, b.minZ, b.maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return Infinity; continue; }
    let t1 = (lo - o) / d, t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
  }
  return tmax >= Math.max(tmin, 0) ? Math.max(tmin, 0) : Infinity;
}
