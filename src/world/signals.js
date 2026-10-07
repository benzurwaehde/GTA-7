import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CITY, ROAD_LINES } from '../core/config.js';
import { makeGlow } from './textures.js';

// Traffic signals at every intersection. One mast per corner, arm reaching over the approaching lane.
// Cycle (22 s): ns green 8 / yellow 2 / all-red 1, then ew green 8 / yellow 2 / all-red 1.
const SLAB = 0.18;
const CYCLE = 22;
const HW = CITY.roadWidth / 2;
const POLE = HW + 0.8;          // mast offset from the intersection centre
const LANE_C = CITY.roadWidth / 4;
const NEAR = 25;                // signalAt range (m)
const RED = 0, YELLOW = 1, GREEN = 2;
const NAMES = ['red', 'yellow', 'green'];
const LIT = [new THREE.Color(1.0, 0.1, 0.08), new THREE.Color(1.0, 0.7, 0.05), new THREE.Color(0.1, 1.0, 0.35)];
const DIM = LIT.map((c) => c.clone().multiplyScalar(0.07));
const BLACK = new THREE.Color(0, 0, 0);
const BULB_Y = [5.75, 5.3, 4.85];

// 0 red, 1 yellow, 2 green for one axis at time t (already offset)
function stateAt(axis, t) {
  const p = ((t % CYCLE) + CYCLE) % CYCLE;
  const q = axis === 'ns' ? p : p - 11;
  if (q < 0) return RED;
  if (q < 8) return GREEN;
  if (q < 10) return YELLOW;
  return RED;
}

function box(w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.translate(x, y, z); g.deleteAttribute('uv');
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

// Local frame: mast at origin, arm along +X, signal face looks toward -Z.
function mastGeo() {
  const d = LANE_C > 0 ? POLE - LANE_C : 4;
  const parts = [
    box(0.28, 0.3, 0.28, 0, 0.15, 0, 0x2a2e33),
    box(0.16, 6.3, 0.16, 0, 3.15, 0, 0x32373d),
    box(d + 0.2, 0.12, 0.12, d / 2, 6.2, 0, 0x32373d),
    box(0.55, 1.45, 0.42, d, 5.3, 0, 0x131517),     // housing
    box(0.8, 1.7, 0.04, d, 5.3, 0.2, 0x0b0c0d),     // backplate
  ];
  const g = mergeGeometries(parts);
  g.userData.armLen = d;
  return g;
}

export class Signals {
  constructor(game, group) {
    this.game = game;
    this._t = 0;
    const N = ROAD_LINES.length;
    this._n = N;
    const geo = mastGeo();
    const d = geo.userData.armLen;

    const poles = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }), N * N * 4);
    const bulbGeo = new THREE.CircleGeometry(0.17, 12).rotateY(Math.PI);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true });
    this.bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, N * N * 12);
    const haloGeo = new THREE.PlaneGeometry(1.5, 1.5).rotateY(Math.PI);
    this.haloMat = new THREE.MeshBasicMaterial({
      map: makeGlow(), color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
    });
    this.halos = new THREE.InstancedMesh(haloGeo, this.haloMat, N * N * 12);

    const base = new THREE.Object3D(), local = new THREE.Matrix4(), m = new THREE.Matrix4();
    // corner (sx, sz) -> [rotation about Y, axis served]
    const corners = [
      [1, 1, Math.PI, 'ns'], [-1, -1, 0, 'ns'], [-1, 1, Math.PI / 2, 'ew'], [1, -1, -Math.PI / 2, 'ew'],
    ];
    this._heads = []; // per intersection: { ns:[bulb idx..], ew:[...] , off, cache }
    let pi = 0, bi = 0;
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
      const x = ROAD_LINES[a], z = ROAD_LINES[b];
      const rec = { ns: [], ew: [], off: ((a * 5 + b * 3) % 7) * 3.1, cn: -1, ce: -1 };
      for (const [sx, sz, rot, axis] of corners) {
        base.position.set(x + sx * POLE, SLAB, z + sz * POLE); base.rotation.set(0, rot, 0); base.scale.set(1, 1, 1);
        base.updateMatrix();
        poles.setMatrixAt(pi++, base.matrix);
        for (let k = 0; k < 3; k++) {
          local.makeTranslation(d, BULB_Y[k], -0.215); m.multiplyMatrices(base.matrix, local);
          this.bulbs.setMatrixAt(bi, m); this.bulbs.setColorAt(bi, DIM[k]);
          local.makeTranslation(d, BULB_Y[k], -0.26); m.multiplyMatrices(base.matrix, local);
          this.halos.setMatrixAt(bi, m); this.halos.setColorAt(bi, BLACK);
          rec[axis].push(bi); bi++;
        }
      }
      this._heads.push(rec);
    }
    for (const im of [poles, this.bulbs, this.halos]) { im.frustumCulled = false; group.add(im); }
    this.bulbs.instanceColor.needsUpdate = true; this.halos.instanceColor.needsUpdate = true;
    this._tmp = new THREE.Color();
  }

  _time() { return this.game.time ?? this._t; }

  // Nearest intersection index or -1
  _nearest(x, z) {
    const c = CITY.cell, r0 = ROAD_LINES[0], N = this._n;
    const a = Math.min(N - 1, Math.max(0, Math.round((x - r0) / c)));
    const b = Math.min(N - 1, Math.max(0, Math.round((z - r0) / c)));
    if (Math.hypot(x - ROAD_LINES[a], z - ROAD_LINES[b]) > NEAR) return -1;
    return a * N + b;
  }

  // Contract: 'green' | 'yellow' | 'red' | null. axis 'ns' = traffic along Z, 'ew' = along X.
  signalAt(x, z, axis) {
    const i = this._nearest(x, z);
    if (i < 0) return null;
    return NAMES[stateAt(axis === 'ew' ? 'ew' : 'ns', this._time() + this._heads[i].off)];
  }

  _paint(rec, axis, state) {
    const ids = rec[axis];
    for (let h = 0; h < 6; h += 3) for (let k = 0; k < 3; k++) {
      const on = k === state;
      this.bulbs.setColorAt(ids[h + k], on ? LIT[k] : DIM[k]);
      this.halos.setColorAt(ids[h + k], on ? LIT[k] : BLACK);
    }
    this.bulbs.instanceColor.needsUpdate = true; this.halos.instanceColor.needsUpdate = true;
  }

  update(dt, night = 0) {
    this._t += dt;
    const t = this._time();
    for (const rec of this._heads) {
      const sn = stateAt('ns', t + rec.off), se = stateAt('ew', t + rec.off);
      if (sn !== rec.cn) { rec.cn = sn; this._paint(rec, 'ns', sn); }
      if (se !== rec.ce) { rec.ce = se; this._paint(rec, 'ew', se); }
    }
    this.haloMat.opacity = 0.55 + night * 0.45;
  }
}
