// Sidewalk graph derived from core/config.js. Nodes are the sidewalk-center corners around every intersection.
// node = { ix, sx, iz, sz }: road line indices, and which side (+1/-1) of that road line the node sits on.
import { CITY, ROAD_LINES } from '../core/config.js';

const B = CITY.blocks;
export const SW_OFF = CITY.roadWidth / 2 + CITY.sidewalk / 2;

export function validSide(i, s) { return !(i === 0 && s < 0) && !(i === B && s > 0); }
export function nodePos(n) { return { x: ROAD_LINES[n.ix] + n.sx * SW_OFF, z: ROAD_LINES[n.iz] + n.sz * SW_OFF }; }
export function nodeKey(n) { return ((n.ix * 2 + (n.sx > 0 ? 1 : 0)) * (B + 1) + n.iz) * 2 + (n.sz > 0 ? 1 : 0); }
export function mkNode(ix, sx, iz, sz) { return { ix, sx, iz, sz }; }

// Neighbors: along the block edge (away from the intersection) or across a road.
export function neighbors(n) {
  const out = [];
  // x direction
  { const ax = n.ix + n.sx;
    if (ax >= 0 && ax <= B && validSide(ax, -n.sx)) out.push({ node: mkNode(ax, -n.sx, n.iz, n.sz), cross: false });
    if (validSide(n.ix, -n.sx)) out.push({ node: mkNode(n.ix, -n.sx, n.iz, n.sz), cross: true }); }
  // z direction
  { const az = n.iz + n.sz;
    if (az >= 0 && az <= B && validSide(az, -n.sz)) out.push({ node: mkNode(n.ix, n.sx, az, -n.sz), cross: false });
    if (validSide(n.iz, -n.sz)) out.push({ node: mkNode(n.ix, n.sx, n.iz, -n.sz), cross: true }); }
  return out;
}

export function nearestIndex(v) {
  let bi = 0;
  for (let i = 1; i < ROAD_LINES.length; i++) if (Math.abs(v - ROAD_LINES[i]) < Math.abs(v - ROAD_LINES[bi])) bi = i;
  return bi;
}
export function nearestNode(x, z) {
  const ix = nearestIndex(x), iz = nearestIndex(z);
  let sx = x >= ROAD_LINES[ix] ? 1 : -1, sz = z >= ROAD_LINES[iz] ? 1 : -1;
  if (!validSide(ix, sx)) sx = -sx;
  if (!validSide(iz, sz)) sz = -sz;
  return mkNode(ix, sx, iz, sz);
}

// Breadth-first path over the sidewalk graph. Returns array of nodes (start..goal) or null.
export function sidewalkPath(start, goal, maxNodes = 400) {
  const gk = nodeKey(goal), sk = nodeKey(start);
  if (gk === sk) return [start];
  const prev = new Map([[sk, null]]);
  const nodes = new Map([[sk, start]]);
  const q = [start];
  for (let h = 0; h < q.length && h < maxNodes; h++) {
    const cur = q[h], ck = nodeKey(cur);
    for (const { node } of neighbors(cur)) {
      const k = nodeKey(node);
      if (prev.has(k)) continue;
      prev.set(k, ck); nodes.set(k, node); q.push(node);
      if (k === gk) {
        const path = [];
        for (let c = k; c !== null; c = prev.get(c)) path.push(nodes.get(c));
        return path.reverse();
      }
    }
  }
  return null;
}

// Random node whose position lies within [minD, maxD] of (px,pz).
export function randomNodeAround(px, pz, minD, maxD, tries = 12, reject) {
  const ci = nearestIndex(px), cj = nearestIndex(pz);
  const span = Math.ceil(maxD / CITY.cell) + 1;
  for (let t = 0; t < tries; t++) {
    const ix = Math.max(0, Math.min(B, ci + Math.floor((Math.random() * 2 - 1) * (span + 0.99))));
    const iz = Math.max(0, Math.min(B, cj + Math.floor((Math.random() * 2 - 1) * (span + 0.99))));
    const sx = Math.random() < 0.5 ? 1 : -1, sz = Math.random() < 0.5 ? 1 : -1;
    if (!validSide(ix, sx) || !validSide(iz, sz)) continue;
    const n = mkNode(ix, sx, iz, sz), p = nodePos(n);
    const d = Math.hypot(p.x - px, p.z - pz);
    if (d < minD || d > maxD) continue;
    if (reject && reject(p.x, p.z)) continue;
    return n;
  }
  return null;
}
