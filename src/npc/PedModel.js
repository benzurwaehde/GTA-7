// Procedural low-poly person. Geometry and materials are shared across all peds.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const box = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };

const GEO = {
  torso: mergeGeometries([box(0.5, 0.62, 0.28, 0, 1.16, 0), box(0.13, 0.58, 0.16, -0.33, 1.13, 0), box(0.13, 0.58, 0.16, 0.33, 1.13, 0)]),
  head: (() => { const g = new THREE.SphereGeometry(0.15, 8, 6); g.translate(0, 1.62, 0); return g; })(),
  leg: (() => { const g = new THREE.BoxGeometry(0.21, 0.84, 0.24); g.translate(0, -0.42, 0); return g; })(),
  hat: mergeGeometries([box(0.34, 0.09, 0.34, 0, 1.76, 0), box(0.34, 0.03, 0.14, 0, 1.73, 0.2)]),
  bill: (() => { const g = new THREE.PlaneGeometry(0.55, 0.28); g.rotateX(-Math.PI / 2); return g; })(),
};

const SKIN = [0xf1c8a5, 0xe0ac86, 0xc68a62, 0x8d5a3b, 0x5e3a24, 0xf6d7b8];
const SHIRT = [0xd9453b, 0x2f7fd1, 0x39a85a, 0xe8c33a, 0x8d4fc2, 0xf0f0f0, 0xe07b2c, 0x2c2c34, 0x2fb8b0, 0xd96aa0];
const PANTS = [0x2a3550, 0x3b3b3b, 0x6a5a45, 0x1d2a44, 0x7a7f8c, 0x4a3a2a];

const matCache = new Map();
export function mat(color) {
  let m = matCache.get(color);
  if (!m) { m = new THREE.MeshLambertMaterial({ color }); matCache.set(color, m); }
  return m;
}
export const billMat = new THREE.MeshBasicMaterial({ color: 0x3fd45b, side: THREE.DoubleSide });
export const billGeo = GEO.bill;

const pick = a => a[Math.floor(Math.random() * a.length)];

export function buildPedMesh(kind = 'civ') {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  let shirt, pants;
  if (kind === 'cop') { shirt = 0x1c3f94; pants = 0x151f3a; }
  else { shirt = pick(SHIRT); pants = pick(PANTS); }
  const skin = pick(SKIN);
  const torso = new THREE.Mesh(GEO.torso, mat(shirt));
  const head = new THREE.Mesh(GEO.head, mat(skin));
  const legL = new THREE.Mesh(GEO.leg, mat(pants)); legL.position.set(-0.12, 0.85, 0);
  const legR = new THREE.Mesh(GEO.leg, mat(pants)); legR.position.set(0.12, 0.85, 0);
  g.add(torso, head, legL, legR);
  if (kind === 'cop') g.add(new THREE.Mesh(GEO.hat, mat(0x0c1226)));
  g.userData = { legL, legR, torso };
  return g;
}
