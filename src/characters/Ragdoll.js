// Verlet ragdoll driving the bones of a Human. 13 particles (hips, shoulders, head, elbows, hands, knees, ankles),
// distance constraints for bones, min-distance "joint limits" for elbows/knees/neck, ground + box collisions.
// No external physics library. Starts from the current animated pose.
import * as THREE from 'three';
import { BONE } from './Human.js';
import { surfaceY } from './surface.js';

const STEP = 1 / 60, GRAV = -18, ITER = 4;
const P = ['hipL', 'hipR', 'shL', 'shR', 'head', 'elbL', 'elbR', 'handL', 'handR', 'kneeL', 'kneeR', 'footL', 'footR'];
const IDX = {}; P.forEach((n, i) => { IDX[n] = i; });
const RAD = [0.13, 0.13, 0.12, 0.12, 0.12, 0.05, 0.05, 0.04, 0.04, 0.07, 0.07, 0.04, 0.04];
// [a, b, kind]: 'd' fixed length, 'min' minimum distance factor of rest length
const LINKS = [
  ['hipL', 'hipR', 'd'], ['shL', 'shR', 'd'], ['hipL', 'shL', 'd'], ['hipR', 'shR', 'd'], ['hipL', 'shR', 'd'], ['hipR', 'shL', 'd'],
  ['head', 'shL', 'd'], ['head', 'shR', 'd'],
  ['shL', 'elbL', 'd'], ['elbL', 'handL', 'd'], ['shR', 'elbR', 'd'], ['elbR', 'handR', 'd'],
  ['hipL', 'kneeL', 'd'], ['kneeL', 'footL', 'd'], ['hipR', 'kneeR', 'd'], ['kneeR', 'footR', 'd'],
  ['shL', 'handL', 'min', 0.3], ['shR', 'handR', 'min', 0.3], ['hipL', 'footL', 'min', 0.28], ['hipR', 'footR', 'min', 0.28],
  ['footL', 'footR', 'min', 0.25], ['kneeL', 'kneeR', 'min', 0.45], ['elbL', 'elbR', 'min', 0.3],
  ['hipL', 'head', 'min', 0.7], ['hipR', 'head', 'min', 0.7],
  ['kneeL', 'shL', 'min', 0.4], ['kneeR', 'shR', 'min', 0.4],      // hip can fold only so far
];
// hinge joints: [a, mid, c, sign]; knees bend towards the front of the body (+1), elbows towards the back of the line (-1)
const HINGES = [['hipL', 'kneeL', 'footL', 1], ['hipR', 'kneeR', 'footR', 1], ['shL', 'elbL', 'handL', -1], ['shR', 'elbR', 'handR', -1]]
  .map(([a, m, c, sg]) => [IDX[a], IDX[m], IDX[c], sg]);
// driven bones: [bone key, particle from, particle to]
const DRIVEN = [
  ['head', 'sh', 'head'],
  ['uArmL', 'shL', 'elbL'], ['lArmL', 'elbL', 'handL'], ['uArmR', 'shR', 'elbR'], ['lArmR', 'elbR', 'handR'],
  ['uLegL', 'hipL', 'kneeL'], ['lLegL', 'kneeL', 'footL'], ['uLegR', 'hipR', 'kneeR'], ['lLegR', 'kneeR', 'footR'],
];

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _m = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

export class Ragdoll {
  // human: Human (root must already be in the scene with its final transform); grid: ColliderGrid or null
  constructor(human, grid) {
    this.h = human; this.grid = grid;
    const n = P.length;
    this.pos = new Float32Array(n * 3); this.prev = new Float32Array(n * 3);
    human.root.updateMatrixWorld(true);
    const wp = (obj, out) => obj.getWorldPosition(out);
    const bw = k => human.bone(k);
    const set = (name, v) => { const i = IDX[name] * 3; this.pos[i] = v.x; this.pos[i + 1] = v.y; this.pos[i + 2] = v.z; };
    set('hipL', wp(bw('uLegL'), _a)); set('hipR', wp(bw('uLegR'), _a));
    set('shL', wp(bw('uArmL'), _a)); set('shR', wp(bw('uArmR'), _a));
    const he = human.model.getObjectByName('Head_end');
    set('head', he ? wp(he, _a) : wp(bw('head'), _a).addScaledVector(_c.set(0, 0.15, 0), 1));
    set('elbL', wp(bw('lArmL'), _a)); set('elbR', wp(bw('lArmR'), _a));
    set('handL', wp(bw('palmL'), _a)); set('handR', wp(bw('palmR'), _a));
    set('kneeL', wp(bw('lLegL'), _a)); set('kneeR', wp(bw('lLegR'), _a));
    set('footL', wp(bw('footL'), _a)); set('footR', wp(bw('footR'), _a));
    this.prev.set(this.pos);
    this.gy = new Float32Array(n);
    this.links = LINKS.map(([a, b, kind, f]) => {
      const ia = IDX[a], ib = IDX[b];
      const d = this._dist(ia, ib);
      return { ia, ib, kind, len: kind === 'min' ? d * f : d };
    });
    // rest data for bone driving (world quaternions + directions at creation)
    this.rest = DRIVEN.map(([k, f, t]) => {
      const bone = bw(k);
      const from = f === 'sh' ? this._mid('shL', 'shR', new THREE.Vector3()) : this._get(IDX[f], new THREE.Vector3());
      const to = this._get(IDX[t], new THREE.Vector3());
      return { bone, f, t, dir0: to.sub(from).normalize(), q0: bone.getWorldQuaternion(new THREE.Quaternion()) };
    });
    // Body (parent of Hips and both upper legs) is the pelvis root of this rig; the feet are separate IK-style bones under the root.
    this.hipsBone = human.bones.Body;
    this.feet = ['L', 'R'].map(side => {
      const bone = human.bones['Foot' + side], leg = human.bones['LowerLeg' + side], pi = IDX['foot' + side];
      return { bone, leg, pi, q0: bone.getWorldQuaternion(new THREE.Quaternion()), p0: bone.getWorldPosition(new THREE.Vector3()),
        legQ0: leg.getWorldQuaternion(new THREE.Quaternion()), pp0: this._get(pi, new THREE.Vector3()) };
    });
    this.basis0 = this._basis(new THREE.Quaternion());
    this.hipsQ0 = this.hipsBone.getWorldQuaternion(new THREE.Quaternion());
    this.hipsP0 = this.hipsBone.getWorldPosition(new THREE.Vector3());
    // body 'front' in torso space, for the hinge limits
    this.fLocal = new THREE.Vector3(0, 0, 1).applyQuaternion(human.root.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(_b2.copy(this.basis0).invert());
    this.hipMid0 = this._mid('hipL', 'hipR', new THREE.Vector3());
    this.acc = 0; this.age = 0; this.calm = 0; this.frozen = false;
    human.mesh.frustumCulled = false;
  }
  _get(i, out) { return out.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]); }
  _mid(a, b, out) { const i = IDX[a] * 3, j = IDX[b] * 3, p = this.pos; return out.set((p[i] + p[j]) / 2, (p[i + 1] + p[j + 1]) / 2, (p[i + 2] + p[j + 2]) / 2); }
  _dist(i, j) { const p = this.pos; return Math.hypot(p[i * 3] - p[j * 3], p[i * 3 + 1] - p[j * 3 + 1], p[i * 3 + 2] - p[j * 3 + 2]); }
  // orientation of the torso quad as a quaternion
  _basis(out) {
    const x = this._get(IDX.hipL, _bx).sub(this._get(IDX.hipR, _by)).normalize();
    const up = this._mid('shL', 'shR', _bu).sub(this._mid('hipL', 'hipR', _by)).normalize();
    _bz.crossVectors(x, up).normalize();
    _by.crossVectors(_bz, x).normalize();
    return out.setFromRotationMatrix(_m.makeBasis(x, _by, _bz));
  }

  // velocity (m/s) for the whole body plus extra push on the upper body
  impulse(vx, vy, vz, upperBoost = 1) {
    for (let i = 0; i < P.length; i++) {
      const k = (i === IDX.shL || i === IDX.shR || i === IDX.head) ? upperBoost : 1;
      this.prev[i * 3] -= vx * k * STEP; this.prev[i * 3 + 1] -= vy * k * STEP; this.prev[i * 3 + 2] -= vz * k * STEP;
    }
  }

  step() {
    const p = this.pos, q = this.prev, n = P.length;
    let move = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      this.gy[i] = surfaceY(p[o], p[o + 2]);
      const vx = (p[o] - q[o]) * 0.992, vy = (p[o + 1] - q[o + 1]) * 0.992, vz = (p[o + 2] - q[o + 2]) * 0.992;
      q[o] = p[o]; q[o + 1] = p[o + 1]; q[o + 2] = p[o + 2];
      p[o] += vx; p[o + 1] += vy + GRAV * STEP * STEP; p[o + 2] += vz;
      move += Math.abs(vx) + Math.abs(vy) + Math.abs(vz);
    }
    for (let it = 0; it < ITER; it++) {
      for (let li = 0; li < this.links.length; li++) {
        const l = this.links[li];
        const a = l.ia * 3, b = l.ib * 3;
        const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        if (l.kind === 'min' && d >= l.len) continue;
        const k = (d - l.len) / d * 0.5;
        p[a] += dx * k; p[a + 1] += dy * k; p[a + 2] += dz * k;
        p[b] -= dx * k; p[b + 1] -= dy * k; p[b + 2] -= dz * k;
      }
      this._hinges();
      this._collide();
    }
    this.move = move;
  }

  // knees / elbows bend in one direction only
  _hinges() {
    const p = this.pos;
    this._basis(_hq);
    _hf.copy(this.fLocal).applyQuaternion(_hq);
    for (let i = 0; i < HINGES.length; i++) {
      const [a, m, c, sg] = HINGES[i];
      const A = a * 3, M = m * 3, C = c * 3;
      const ox = p[M] - (p[A] + p[C]) / 2, oy = p[M + 1] - (p[A + 1] + p[C + 1]) / 2, oz = p[M + 2] - (p[A + 2] + p[C + 2]) / 2;
      const adj = -0.01 - (ox * _hf.x + oy * _hf.y + oz * _hf.z) * sg;
      if (adj <= 0) continue;
      const k = adj * sg;
      p[M] += _hf.x * k * 0.8; p[M + 1] += _hf.y * k * 0.8; p[M + 2] += _hf.z * k * 0.8;
      p[A] -= _hf.x * k * 0.4; p[A + 1] -= _hf.y * k * 0.4; p[A + 2] -= _hf.z * k * 0.4;
      p[C] -= _hf.x * k * 0.4; p[C + 1] -= _hf.y * k * 0.4; p[C + 2] -= _hf.z * k * 0.4;
    }
  }

  _collide() {
    const p = this.pos, q = this.prev, n = P.length;
    for (let i = 0; i < n; i++) {
      const o = i * 3, r = RAD[i];
      if (p[o + 1] < this.gy[i] + r) {
        p[o + 1] = this.gy[i] + r;
        // ground friction: kill most of the horizontal velocity
        q[o] += (p[o] - q[o]) * 0.25; q[o + 2] += (p[o + 2] - q[o + 2]) * 0.25;
      }
      const boxes = this.grid?.near?.(p[o], p[o + 2], r + 0.2);
      if (boxes) for (const b of boxes) {
        if (b.maxY !== undefined && p[o + 1] > b.maxY + r) continue;
        const x = p[o], z = p[o + 2];
        if (x < b.minX - r || x > b.maxX + r || z < b.minZ - r || z > b.maxZ + r) continue;
        const dl = x - (b.minX - r), dr = (b.maxX + r) - x, db = z - (b.minZ - r), df = (b.maxZ + r) - z;
        const m = Math.min(dl, dr, db, df);
        if (m === dl) p[o] = b.minX - r; else if (m === dr) p[o] = b.maxX + r; else if (m === db) p[o + 2] = b.minZ - r; else p[o + 2] = b.maxZ + r;
      }
    }
  }

  // advance by dt; returns false once the body has come to rest
  update(dt) {
    if (this.frozen) return false;
    this.acc = Math.min(this.acc + dt, 0.1); this.age += dt;
    let stepped = false;
    while (this.acc >= STEP) { this.acc -= STEP; this.step(); stepped = true; }
    if (stepped) {
      this.apply();
      if (this.age > 0.6 && this.move < 0.004) this.calm += dt; else this.calm = 0;
      if (this.calm > 0.7 || this.age > 9) { this.frozen = true; return false; }
    }
    return true;
  }
  freeze() { this.frozen = true; }

  apply() {
    // pelvis: rotate/translate the Hips bone from the torso quad
    const cur = this._basis(_q);
    const dq = _q2.copy(cur).multiply(_b2.copy(this.basis0).invert());
    const hb = this.hipsBone;
    this._mid('hipL', 'hipR', _a);
    _b.copy(this.hipsP0).sub(this.hipMid0).applyQuaternion(dq).add(_a);       // target world position
    hb.parent.updateWorldMatrix(true, false);
    hb.parent.worldToLocal(_b);
    hb.position.copy(_b);
    _c4.copy(dq).multiply(this.hipsQ0);
    hb.parent.getWorldQuaternion(_q3);
    hb.quaternion.copy(_q3.invert().multiply(_c4));
    hb.updateMatrixWorld(true);
    // limbs / head
    for (const r of this.rest) {
      const from = r.f === 'sh' ? this._mid('shL', 'shR', _a) : this._get(IDX[r.f], _a);
      const to = this._get(IDX[r.t], _b);
      to.sub(from).normalize();
      _c4.setFromUnitVectors(r.dir0, to).multiply(r.q0);
      r.bone.parent.getWorldQuaternion(_q3);
      r.bone.quaternion.copy(_q3.invert().multiply(_c4));
      r.bone.updateMatrixWorld(true);
    }
    // feet follow the rotation of their lower leg and sit on the ankle particle
    for (const f of this.feet) {
      f.leg.getWorldQuaternion(_q3);
      _q2.copy(_q3).multiply(_b2.copy(f.legQ0).invert());                      // lower-leg delta
      this._get(f.pi, _a);
      _b.copy(f.p0).sub(f.pp0).applyQuaternion(_q2).add(_a);
      f.bone.parent.updateWorldMatrix(true, false);
      f.bone.parent.worldToLocal(_b); f.bone.position.copy(_b);
      _c4.copy(_q2).multiply(f.q0);
      f.bone.parent.getWorldQuaternion(_q3);
      f.bone.quaternion.copy(_q3.invert().multiply(_c4));
      f.bone.updateMatrixWorld(true);
    }
  }

  // centre of the pelvis in world space
  pelvis(out) { return this._mid('hipL', 'hipR', out); }
}
const _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3(), _bu = new THREE.Vector3();
const _hq = new THREE.Quaternion(), _hf = new THREE.Vector3();
const _b2 = new THREE.Quaternion(), _c4 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
