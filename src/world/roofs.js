import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Parts } from './parts.js';
import { mulberry32 } from './util.js';

// Roof details on flat roofs: air-conditioning units, water tanks and antennas, as 3 InstancedMeshes (3 draw calls).
// Uses its own RNG, so the city layout does not change. rects: [x0, z0, x1, z1, roofY] of every flat roof.
function acGeo() {
  const P = new Parts();
  P.box(0, 0.45, 0, 1.8, 0.9, 1.2, 0xffffff);
  P.cyl(0.35, 0.9, 0, 0.42, 0.42, 0.06, 0x2a2d30, 10);
  P.box(-0.55, 0.45, 0.61, 0.5, 0.6, 0.04, 0x444a50);
  P.box(0, 0.05, 0, 2.0, 0.1, 1.4, 0x6a6e72);
  return P.build();
}
function tankGeo() {
  const P = new Parts();
  for (const sx of [-0.7, 0.7]) for (const sz of [-0.7, 0.7]) P.box(sx, 0.6, sz, 0.14, 1.2, 0.14, 0x3a3a3c);
  P.box(0, 1.25, 0, 1.9, 0.12, 1.9, 0x3a3a3c);
  P.cyl(0, 1.3, 0, 1.0, 1.0, 2.0, 0xffffff, 10);
  P.cyl(0, 3.3, 0, 0.05, 1.05, 0.6, 0x555a60, 10);
  return P.build();
}
function antennaGeo() {
  const P = new Parts();
  P.box(0, 3.0, 0, 0.1, 6.0, 0.1, 0xb0b4b8);
  for (const [y, w] of [[3.6, 1.6], [4.4, 1.3], [5.2, 1.0]]) P.box(0, y, 0, w, 0.05, 0.05, 0xb0b4b8);
  P.box(0, 6.05, 0, 0.14, 0.14, 0.14, 0xff3030);
  P.box(0.7, 1.4, 0.3, 0.9, 0.7, 0.05, 0x888c90, 0.6); // small dish plate
  return P.build();
}

// Returns one merged geometry (position, normal, uv, color) with all roof details; City merges it into the roof mesh,
// so the details cost no extra draw call.
export function buildRoofDetails(rects) {
  const rnd = mulberry32(2024);
  const types = [
    { geo: acGeo(), tints: [0xc9cdd0, 0xb4babe, 0xdedfdc, 0xa6acb2], spots: [] },
    { geo: tankGeo(), tints: [0x8a5e3a, 0x7d8a92, 0xa89a82, 0x6d7a6a], spots: [] },
    { geo: antennaGeo(), tints: [0xffffff, 0xd8d8d8], spots: [] },
  ];
  for (const [x0, z0, x1, z1, y] of rects) {
    const w = x1 - x0, d = z1 - z0;
    if (w < 7 || d < 7) continue;
    const at = (t, inset = 2.2) => types[t].spots.push([x0 + inset + rnd() * (w - inset * 2), y, z0 + inset + rnd() * (d - inset * 2), rnd() < 0.5 ? 0 : Math.PI / 2]);
    const nAc = 1 + ((rnd() * 3) | 0);
    for (let i = 0; i < nAc; i++) at(0);
    if (rnd() < 0.32) at(1, 3);
    if (rnd() < 0.55) at(2, 1.5);
  }
  const out = [], m = new THREE.Matrix4(), c = new THREE.Color();
  for (const t of types) for (const [x, y, z, ry] of t.spots) {
    const g = t.geo.clone();
    m.makeRotationY(ry).setPosition(x, y, z); g.applyMatrix4(m);
    c.setHex(t.tints[(rnd() * t.tints.length) | 0]).multiplyScalar(0.85 + rnd() * 0.3);
    const col = g.attributes.color, n = col.count;
    for (let i = 0; i < n; i++) col.setXYZ(i, col.getX(i) * c.r, col.getY(i) * c.g, col.getZ(i) * c.b);
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    out.push(g);
  }
  return out.length ? mergeGeometries(out) : null;
}
