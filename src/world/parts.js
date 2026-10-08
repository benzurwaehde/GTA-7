import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Small helper to assemble one vertex-coloured geometry out of boxes, bars and cylinders (built once at load,
// so allocations here do not matter). Result: position + normal + color attributes, ready for one draw call.
const _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _e = new THREE.Euler();
const _m = new THREE.Matrix4(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1);

export class Parts {
  constructor() { this.list = []; }

  add(geo, color, m) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (m) g.applyMatrix4(m);
    g.deleteAttribute('uv');
    const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.list.push(g);
    return this;
  }

  // Box centred at (cx,cy,cz), size (sx,sy,sz), yaw ry (rad), optional pitch/roll.
  box(cx, cy, cz, sx, sy, sz, color, ry = 0, rx = 0, rz = 0) {
    _m.compose(_p.set(cx, cy, cz), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s);
    return this.add(new THREE.BoxGeometry(sx, sy, sz), color, _m);
  }

  // Square bar from point a to point b.
  bar(ax, ay, az, bx, by, bz, t, color) {
    _a.set(ax, ay, az); _b.set(bx, by, bz);
    const len = _a.distanceTo(_b);
    _m.compose(_p.copy(_a).add(_b).multiplyScalar(0.5), _q.setFromUnitVectors(_z, _b.sub(_a).normalize()), _s);
    return this.add(new THREE.BoxGeometry(t, t, len), color, _m);
  }

  // Cylinder / cone along Y, base at y.
  cyl(cx, y, cz, rTop, rBot, h, color, segs = 8) {
    _m.makeTranslation(cx, y + h / 2, cz);
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, segs), color, _m);
  }

  sphere(cx, cy, cz, r, color, segs = 6) {
    _m.makeTranslation(cx, cy, cz);
    return this.add(new THREE.SphereGeometry(r, segs, segs - 1), color, _m);
  }

  build() { return mergeGeometries(this.list); }
}
