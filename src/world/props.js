import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function part(geo, color, m) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (m) g.applyMatrix4(m);
  g.deleteAttribute('uv');
  const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const S = (x, y, z) => new THREE.Matrix4().makeScale(x, y, z);

export function treeGeo() {
  const parts = [
    part(new THREE.CylinderGeometry(0.16, 0.28, 3.0, 7), 0x8a5e3a, T(0, 1.5, 0)),
    part(new THREE.IcosahedronGeometry(2.1, 0), 0x3f8a3a, T(0, 4.4, 0).multiply(S(1, 0.85, 1))),
    part(new THREE.IcosahedronGeometry(1.5, 0), 0x4fa044, T(1.0, 3.5, 0.4)),
    part(new THREE.IcosahedronGeometry(1.4, 0), 0x357a33, T(-0.9, 3.8, -0.5)),
    part(new THREE.IcosahedronGeometry(1.2, 0), 0x5aae4c, T(0.1, 5.5, 0.1)),
  ];
  return mergeGeometries(parts);
}

export function palmGeo() {
  const parts = [];
  let x = 0, y = 0;
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Matrix4().makeRotationZ(-0.07 * i);
    const seg = new THREE.CylinderGeometry(0.17 - i * 0.012, 0.2 - i * 0.012, 1.4, 6);
    seg.translate(0, 0.7, 0); seg.applyMatrix4(m); seg.translate(x, y, 0);
    parts.push(part(seg, i % 2 ? 0x8a6a47 : 0x7a5c3d));
    x += -Math.sin(0.07 * i) * 1.4; y += Math.cos(0.07 * i) * 1.4;
  }
  for (let k = 0; k < 9; k++) {
    const leaf = new THREE.BoxGeometry(3.6, 0.06, 0.75, 4, 1, 1);
    const p = leaf.attributes.position;
    for (let i = 0; i < p.count; i++) { // taper + droop
      const lx = p.getX(i) + 1.8;
      p.setZ(i, p.getZ(i) * (1 - lx / 4.2));
      p.setY(i, p.getY(i) - lx * lx * 0.1);
    }
    leaf.translate(1.8, 0, 0);
    leaf.applyMatrix4(new THREE.Matrix4().makeRotationY((k / 9) * Math.PI * 2 + (k % 2) * 0.2));
    leaf.applyMatrix4(new THREE.Matrix4().makeRotationZ(0));
    leaf.translate(x, y + 0.1 + (k % 2) * 0.15, 0);
    parts.push(part(leaf, k % 2 ? 0x2f8a3c : 0x3d9c46));
  }
  parts.push(part(new THREE.SphereGeometry(0.28, 6, 5), 0x6a4a2a, T(x, y - 0.1, 0)));
  return mergeGeometries(parts);
}

export function lampPoleGeo() {
  const parts = [
    part(new THREE.CylinderGeometry(0.1, 0.14, 7.2, 6), 0x3a3f46, T(0, 3.6, 0)),
    part(new THREE.BoxGeometry(1.5, 0.1, 0.1), 0x3a3f46, T(0.7, 7.15, 0)),
    part(new THREE.CylinderGeometry(0.22, 0.28, 0.4, 6), 0x2c3036, T(0, 0.2, 0)),
  ];
  return mergeGeometries(parts);
}
export function lampHeadGeo() { const g = new THREE.BoxGeometry(0.9, 0.14, 0.38); g.translate(1.3, 7.08, 0); return g; }
