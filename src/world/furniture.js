import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CITY, blockBounds } from '../core/config.js';
import { mulberry32 } from './util.js';

// Street furniture on the sidewalks: benches, hydrants, bins, mailboxes. 4 InstancedMeshes = 4 draw calls.
// Procedural (no Blender): local +Z points toward the road.
const SLAB = 0.18;

function part(geo, color, m) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (m) g.applyMatrix4(m);
  g.deleteAttribute('uv');
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const bx = (w, h, d, x, y, z, col) => part(new THREE.BoxGeometry(w, h, d), col, T(x, y, z));

function benchGeo() {
  return mergeGeometries([
    bx(1.7, 0.07, 0.24, 0, 0.46, 0.1, 0x9a6a3c), bx(1.7, 0.07, 0.24, 0, 0.46, -0.16, 0x9a6a3c),
    bx(1.7, 0.1, 0.05, 0, 0.78, -0.3, 0x9a6a3c), bx(1.7, 0.1, 0.05, 0, 0.62, -0.3, 0x9a6a3c),
    bx(0.07, 0.45, 0.5, -0.8, 0.22, -0.05, 0x2e3238), bx(0.07, 0.45, 0.5, 0.8, 0.22, -0.05, 0x2e3238),
    bx(0.07, 0.4, 0.07, -0.8, 0.65, -0.3, 0x2e3238), bx(0.07, 0.4, 0.07, 0.8, 0.65, -0.3, 0x2e3238),
  ]);
}
function hydrantGeo() {
  return mergeGeometries([
    part(new THREE.CylinderGeometry(0.15, 0.17, 0.62, 8), 0xc42020, T(0, 0.31, 0)),
    part(new THREE.SphereGeometry(0.16, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0xd83030, T(0, 0.62, 0)),
    part(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6), 0xb81c1c, T(0, 0.42, 0).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2))),
    part(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 8), 0x8a1616, T(0, 0.04, 0)),
  ]);
}
function binGeo() {
  return mergeGeometries([
    part(new THREE.CylinderGeometry(0.3, 0.26, 0.85, 10), 0x2f5a3a, T(0, 0.43, 0)),
    part(new THREE.CylinderGeometry(0.33, 0.33, 0.07, 10), 0x1f3a26, T(0, 0.88, 0)),
    part(new THREE.CylinderGeometry(0.31, 0.31, 0.05, 10), 0x1a1a1a, T(0, 0.5, 0)),
  ]);
}
function mailboxGeo() {
  return mergeGeometries([
    bx(0.12, 0.8, 0.12, 0, 0.4, 0, 0x30343a),
    bx(0.55, 0.45, 0.42, 0, 0.95, 0, 0x1f4fa0),
    part(new THREE.CylinderGeometry(0.21, 0.21, 0.55, 10, 1, false, 0, Math.PI), 0x1f4fa0, T(0, 1.175, 0).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2))),
    bx(0.3, 0.05, 0.02, 0, 1.0, 0.215, 0x111111),
  ]);
}

export function buildFurniture(group) {
  const rnd = mulberry32(9090);
  const spots = { bench: [], hydrant: [], bin: [], mailbox: [] };
  const L = CITY.blockSize, inset = 1.7;
  for (let i = 0; i < CITY.blocks; i++) for (let j = 0; j < CITY.blocks; j++) {
    const b = blockBounds(i, j);
    // edge: [x at t, z at t, outward normal x, outward normal z]
    const edges = [
      (t) => [b.minX + t, b.minZ + inset, 0, -1], (t) => [b.minX + t, b.maxZ - inset, 0, 1],
      (t) => [b.minX + inset, b.minZ + t, -1, 0], (t) => [b.maxX - inset, b.minZ + t, 1, 0],
    ];
    for (const e of edges) {
      const slots = [['hydrant', 9, 0.35], ['bin', 22, 0.4], ['bench', 30, 0.45], ['mailbox', 38, 0.25], ['bench', 52, 0.15]];
      for (const [kind, t0, p] of slots) {
        if (rnd() > p) continue;
        const t = Math.min(L - 6, t0 + (rnd() - 0.5) * 3);
        const [x, z, nx, nz] = e(t);
        spots[kind].push([x, z, Math.atan2(nx, nz)]);
      }
    }
  }
  const defs = { bench: benchGeo(), hydrant: hydrantGeo(), bin: binGeo(), mailbox: mailboxGeo() };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 });
  const d = new THREE.Object3D();
  let n = 0;
  for (const kind of Object.keys(defs)) {
    const list = spots[kind];
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(defs[kind], mat, list.length);
    list.forEach(([x, z, rot], k) => { d.position.set(x, SLAB, z); d.rotation.set(0, rot, 0); d.updateMatrix(); im.setMatrixAt(k, d.matrix); });
    im.castShadow = true; im.frustumCulled = false;
    group.add(im); n += list.length;
  }
  return n;
}
