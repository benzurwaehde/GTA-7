// Procedural low-poly person. Base part geometry is built once; per-ped merged parts (upper body, arms, legs)
// bake their colors into vertex colors and are cached/ref-counted by outfit key, so all peds share ONE material
// and a ped costs 5 draw calls (upper body, 2 arms, 2 legs).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const SKIN = [0xf1c8a5, 0xe0ac86, 0xc68a62, 0x8d5a3b, 0x5e3a24, 0xf6d7b8];
const SHIRT = [0xd9453b, 0x2f7fd1, 0x39a85a, 0xe8c33a, 0x8d4fc2, 0xf0f0f0, 0xe07b2c, 0x2c2c34, 0x2fb8b0, 0xd96aa0];
const PANTS = [0x2a3550, 0x3b3b3b, 0x6a5a45, 0x1d2a44, 0x7a7f8c, 0x4a3a2a];
const HAIR = [0x1c1410, 0x3a2418, 0x6b4a2a, 0xc9a24a, 0x9a3b22, 0x8a8a8a];
const SHOE = 0x1a1a1e;
const BODIES = {
  slim:   { tw: 0.40, td: 0.24, arm: 0.07, leg: 0.085, sx: 0.28, scale: 1.04 },
  normal: { tw: 0.48, td: 0.28, arm: 0.085, leg: 0.105, sx: 0.33, scale: 1.0 },
  sturdy: { tw: 0.60, td: 0.34, arm: 0.105, leg: 0.13, sx: 0.40, scale: 0.97 },
};
const HIP_Y = 0.85, SHOULDER_Y = 1.42;

export const billMat = new THREE.MeshBasicMaterial({ color: 0x3fd45b, side: THREE.DoubleSide });
export const billGeo = (() => { const g = new THREE.PlaneGeometry(0.55, 0.28); g.rotateX(-Math.PI / 2); return g; })();
const pedMat = new THREE.MeshLambertMaterial({ vertexColors: true });

// ---- geometry helpers ----
function paint(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function cyl(rt, rb, h, seg, x, y, z, hex, sx = 1, sz = 1) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.scale(sx, 1, sz); g.translate(x, y, z);
  return paint(g, hex);
}
function ball(r, ws, hs, x, y, z, hex, sy = 1) {
  const g = new THREE.SphereGeometry(r, ws, hs);
  g.scale(1, sy, 1); g.translate(x, y, z);
  return paint(g, hex);
}
function box(w, h, d, x, y, z, hex) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return paint(g, hex); }
function merge(parts) { const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); return g; }

// ---- cached merged parts ----
const cache = new Map();
function acquire(key, make) {
  let e = cache.get(key);
  if (!e) { e = { geo: make(), refs: 0 }; cache.set(key, e); }
  e.refs++;
  return e.geo;
}
function release(key) {
  const e = cache.get(key);
  if (e && --e.refs <= 0) { e.geo.dispose(); cache.delete(key); }
}

function makeUpper(o) {
  const B = BODIES[o.body], parts = [];
  // torso: tapered, elliptical cylinder (shoulders wider than waist)
  parts.push(cyl(B.tw * 0.62, B.tw * 0.5, 0.64, 8, 0, 1.12, 0, o.shirt, 1, B.td / B.tw));
  // neck + head
  parts.push(cyl(0.05, 0.06, 0.1, 6, 0, 1.46, 0, o.skin));
  parts.push(ball(0.145, 10, 8, 0, 1.62, 0, o.skin, 1.08));
  // nose bump gives a facing direction
  parts.push(box(0.04, 0.05, 0.05, 0, 1.6, 0.15, o.skin));
  if (o.skirt) parts.push(cyl(B.tw * 0.52, B.tw * 0.78, 0.36, 8, 0, 0.78, 0, o.pants, 1, 0.85));
  else parts.push(cyl(B.tw * 0.5, B.tw * 0.5, 0.2, 8, 0, 0.84, 0, o.pants, 1, B.td / B.tw)); // belt-line, hides leg gap
  // hair / hats
  const h = o.hairStyle;
  if (h === 'short' || h === 'long') {
    const g = new THREE.SphereGeometry(0.158, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.58);
    g.scale(1, 1.08, 1.04); g.translate(0, 1.625, -0.012); parts.push(paint(g, o.hair));
    if (h === 'long') parts.push(box(0.27, 0.3, 0.07, 0, 1.52, -0.12, o.hair));
  } else if (h === 'cap') {
    const g = new THREE.SphereGeometry(0.162, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
    g.scale(1, 1, 1.04); g.translate(0, 1.64, 0); parts.push(paint(g, o.hat));
    parts.push(box(0.2, 0.025, 0.16, 0, 1.655, 0.19, o.hat));
  } else if (h === 'police') {
    parts.push(cyl(0.17, 0.17, 0.09, 10, 0, 1.755, 0, o.hat));
    parts.push(box(0.3, 0.025, 0.14, 0, 1.715, 0.17, o.hat));
  } else if (h === 'beanie') {
    const g = new THREE.SphereGeometry(0.166, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
    g.scale(1, 1.1, 1.05); g.translate(0, 1.635, 0); parts.push(paint(g, o.hat));
  }
  return merge(parts);
}
function makeArm(o) {
  const B = BODIES[o.body], r = B.arm, parts = [];
  // pivot at the shoulder (origin), arm hangs down -y
  parts.push(cyl(r * 1.1, r, 0.3, 6, 0, -0.15, 0, o.shirt));
  parts.push(cyl(r, r * 0.85, 0.3, 6, 0, -0.45, 0, o.longSleeve ? o.shirt : o.skin));
  parts.push(ball(r * 1.05, 6, 5, 0, -0.62, 0, o.skin));
  return merge(parts);
}
function makeLeg(o) {
  const B = BODIES[o.body], r = B.leg, parts = [];
  // pivot at the hip (origin), leg hangs down -y
  const c = o.skirt ? o.skin : o.pants;
  parts.push(cyl(r, r * 0.85, 0.82, 7, 0, -0.41, 0, c));
  parts.push(box(r * 2.0, 0.07, r * 3.0, 0, -0.815, r * 0.7, SHOE));
  return merge(parts);
}

const pick = a => a[Math.floor(Math.random() * a.length)];

export function buildPedMesh(kind = 'civ') {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const cop = kind === 'cop';
  const o = cop
    ? { body: 'normal', skin: pick(SKIN), shirt: 0x1c3f94, pants: 0x151f3a, hair: 0, hairStyle: 'police', hat: 0x0c1226, skirt: false, longSleeve: true }
    : (() => {
        const r = Math.random(), skirt = Math.random() < 0.3;
        const hs = pick(['short', 'short', 'long', 'cap', 'bald', 'beanie']);
        return {
          body: r < 0.3 ? 'slim' : r < 0.65 ? 'normal' : 'sturdy',
          skin: pick(SKIN), shirt: pick(SHIRT), pants: skirt ? pick(SHIRT) : pick(PANTS),
          hair: pick(HAIR), hairStyle: skirt && hs === 'bald' ? 'long' : hs, hat: pick(SHIRT), skirt,
          longSleeve: Math.random() < 0.4,
        };
      })();
  const B = BODIES[o.body];
  // keys: only the inputs that affect each part, so parts are shared between peds
  const kU = `u|${o.body}|${o.skin}|${o.shirt}|${o.pants}|${o.hair}|${o.hairStyle}|${o.hat}|${o.skirt ? 1 : 0}`;
  const kA = `a|${o.body}|${o.skin}|${o.shirt}|${o.longSleeve ? 1 : 0}`;
  const kL = `l|${o.body}|${o.skirt ? o.skin : o.pants}|${o.skirt ? 1 : 0}`;
  const upper = new THREE.Mesh(acquire(kU, () => makeUpper(o)), pedMat);
  const armGeo = acquire(kA, () => makeArm(o));
  const legGeo = acquire(kL, () => makeLeg(o));
  const armL = new THREE.Mesh(armGeo, pedMat), armR = new THREE.Mesh(armGeo, pedMat);
  armL.position.set(-B.sx, SHOULDER_Y, 0); armR.position.set(B.sx, SHOULDER_Y, 0);
  const legL = new THREE.Mesh(legGeo, pedMat), legR = new THREE.Mesh(legGeo, pedMat);
  legL.position.set(-B.leg - 0.02, HIP_Y, 0); legR.position.set(B.leg + 0.02, HIP_Y, 0);
  g.add(upper, armL, armR, legL, legR);
  g.scale.setScalar(B.scale * (0.94 + Math.random() * 0.12));
  g.userData = { legL, legR, armL, armR, torso: upper, keys: [kU, kA, kA, kL, kL] };
  return g;
}

// Called when a ped is removed: frees geometry no other ped uses.
export function releasePedMesh(mesh) {
  const k = mesh?.userData?.keys;
  if (!k) return;
  const seen = k.slice(0, 1).concat(k[1], k[3]); // arms/legs are acquired once per ped
  mesh.userData.keys = null;
  for (const key of seen) release(key);
}
