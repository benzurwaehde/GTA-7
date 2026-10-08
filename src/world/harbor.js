import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GB, mulberry32, rgb } from './util.js';
import { Parts } from './parts.js';
import { COAST } from './coast.js';
import { getModel } from '../core/assets.js';
import * as TX from './textures.js';
import { seaSurface } from './water.js';

// Marlin Pier harbour (south coast, x=0 road axis): wooden pier with a T-head, a boardwalk, a quay with containers,
// two portal cranes and a cargo ship, boats riding the waves. Walkable parts have colliders (rails, curb, cranes' legs,
// container stacks). Draw calls: wood, solid, lamps, containers, 3 boat types = 7.
// Everything is merged / instanced; all dimensions are absolute (H = CITY.half).
const H = COAST.H;
const WALL = COAST.wall;
const PIER = { x: 0, hw: 4, z0: H + 8, zHead: H + 112, zEnd: H + 126, headHW: 14 };
const QUAY = { x0: 36, x1: 152, z0: H + 26, z1: H + 46 };
const CONTAINER = { L: 12.2, W: 2.5, Hh: 2.6 };
const CONTAINER_COLORS = [0xb23a2e, 0x2e5e9e, 0x3b8a4f, 0xd6a423, 0xe4e4e0, 0x8a4a2a, 0x555a60, 0x1f7a8c, 0x9a2f5a];

export class Harbor {
  constructor(group, colliders) {
    this.group = group; this.colliders = colliders;
    this.rnd = mulberry32(4242);
    this.t = 0;
    this._mats();
    this._pier();
    this._boardwalk();
    this._quay();
    this._boats();
    this._mesh(this._wood.build(), this.woodMat, true);
    this._mesh(this._solid.build(), this.solidMat, true);
    this.update(0, 0);
  }

  _mats() {
    this.woodMat = new THREE.MeshStandardMaterial({ map: TX.makeWood(mulberry32(77), 8), vertexColors: true, roughness: 0.9 });
    this.solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 });
  }

  _box(x0, z0, x1, z1, maxY, type = 'rail') {
    this.colliders.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, maxY, type });
  }

  _mesh(geo, mat, cast = false, cull = true) {
    const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = cull;
    this.group.add(m); return m;
  }

  // ---------------------------------------------------------------- pier
  _pier() {
    const W = this._wood = new GB(), S = new Parts();
    const { hw, z0, zHead, zEnd, headHW } = PIER;
    const wood = [1, 1, 1], dark = rgb(0x5a4330), post = rgb(0xcfc3b0), top = -0.25, deck = 0.06;
    W.box(-hw, top, z0, hw, deck, zHead, wood, { mode: 'world' });
    W.box(-headHW, top, zHead, headHW, deck, zEnd, wood, { mode: 'world' });
    // piles under the deck (only where the ground is under water)
    for (let z = H + 30; z <= zHead; z += 5) for (const x of [-3.6, 3.6]) W.box(x - 0.2, -3.3, z - 0.2, x + 0.2, top, z + 0.2, dark, { mode: 'world' });
    for (const x of [-12, -6, 6, 12]) for (let z = zHead + 2; z <= zEnd - 1; z += 6) W.box(x - 0.22, -3.3, z - 0.22, x + 0.22, top, z + 0.22, dark, { mode: 'world' });
    // rails: posts + two rails, along the pier sides (over water) and around the T-head
    const rail = (xa, za, xb, zb) => {
      const len = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(len / 3));
      for (let i = 0; i <= n; i++) {
        const x = xa + (xb - xa) * i / n, z = za + (zb - za) * i / n;
        W.box(x - 0.07, deck, z - 0.07, x + 0.07, deck + 1.05, z + 0.07, post, { mode: 'world' });
      }
      const rx0 = Math.min(xa, xb), rx1 = Math.max(xa, xb), rz0 = Math.min(za, zb), rz1 = Math.max(za, zb);
      for (const y of [0.55, 1.02]) W.box(rx0 - 0.05, deck + y - 0.04, rz0 - 0.05, rx1 + 0.05, deck + y + 0.04, rz1 + 0.05, post, { mode: 'world' });
    };
    const zS = H + 31;
    rail(-hw + 0.1, zS, -hw + 0.1, zHead); rail(hw - 0.1, zS, hw - 0.1, zHead);
    rail(-headHW + 0.1, zHead, -hw + 0.1, zHead); rail(hw - 0.1, zHead, headHW - 0.1, zHead);
    rail(-headHW + 0.1, zHead, -headHW + 0.1, zEnd - 0.1); rail(headHW - 0.1, zHead, headHW - 0.1, zEnd - 0.1);
    rail(-headHW + 0.1, zEnd - 0.1, headHW - 0.1, zEnd - 0.1);
    // invisible colliders hugging the rails (low enough to be ignored by the camera, too high to jump)
    this._box(-hw - 0.6, zS, -hw, zHead - 0.6, 1.9); this._box(hw, zS, hw + 0.6, zHead - 0.6, 1.9);
    this._box(-headHW - 0.6, zHead - 0.6, -hw, zHead, 1.9); this._box(hw, zHead - 0.6, headHW + 0.6, zHead, 1.9);
    this._box(-headHW - 0.6, zHead, -headHW, zEnd + 0.6, 1.9); this._box(headHW, zHead, headHW + 0.6, zEnd + 0.6, 1.9);
    this._box(-headHW, zEnd, headHW, zEnd + 0.6, 1.9);
    // lamps along the pier + T-head corners
    const lamp = (x, z) => {
      S.box(x, deck + 1.7, z, 0.12, 3.4, 0.12, 0x3a3f46);
      S.box(x, deck + 3.5, z, 0.5, 0.18, 0.5, 0xffffff);
    };
    for (let z = H + 40; z < zHead; z += 18) { lamp(-hw + 0.1, z); lamp(hw - 0.1, z + 9); }
    for (const [x, z] of [[-headHW + 0.5, zHead + 1], [headHW - 0.5, zHead + 1], [-headHW + 0.5, zEnd - 1], [headHW - 0.5, zEnd - 1], [0, zEnd - 1]]) lamp(x, z);
    // bollards on the T-head and a small bait kiosk with a collider
    for (let x = -12; x <= 12; x += 6) S.cyl(x, deck, zEnd - 0.7, 0.2, 0.26, 0.5, 0x2a2a2e, 6);
    S.box(-9, deck + 1.5, zHead + 7, 4.5, 3, 3.4, 0xe9e2d0); S.box(-9, deck + 3.15, zHead + 7, 5.2, 0.3, 4.1, 0x2f7f8c);
    S.box(-9, deck + 1.6, zHead + 5.28, 3.0, 1.1, 0.08, 0x203040);
    this._box(-11.3, zHead + 5.3, -6.7, zHead + 8.7, 3.2, 'building');
    // a few fishing rod stands / crates for clutter
    for (const [x, z] of [[9, zHead + 4], [11, zHead + 9], [-4, zEnd - 3]]) S.box(x, deck + 0.35, z, 0.9, 0.7, 0.9, 0x7a5a38, x);
    this._solid = S;
  }

  // ---------------------------------------------------------------- boardwalk along the beach (south), lamps
  _boardwalk() {
    const W = this._wood, S = this._solid;
    const z0 = H + 21, z1 = H + 25.5, y = 0.05;
    const segs = [[-282, -PIER.hw - 0.5], [PIER.hw + 0.5, QUAY.x0 - 1]];
    for (const [xa, xb] of segs) {
      W.box(xa, 0, z0, xb, y, z1, [1, 1, 1], { mode: 'world' });
      for (let x = Math.ceil(xa / 24) * 24; x < xb; x += 24) {
        S.box(x, 2.1, z1 - 0.3, 0.12, 4.2, 0.12, 0x3a3f46);
        S.box(x, 4.3, z1 - 0.3, 0.55, 0.18, 0.55, 0xffffff);
        S.box(x + 3, 0.5, z0 + 0.8, 1.7, 0.1, 0.5, 0x8a5a30); S.box(x + 3, 0.25, z0 + 0.8, 1.5, 0.5, 0.1, 0x2e3238);
      }
    }
  }

  // ---------------------------------------------------------------- quay, cranes, ship, containers
  _quay() {
    const S = this._solid, rnd = this.rnd, { x0, x1, z0, z1 } = QUAY;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    S.box(cx, -1.3, cz, x1 - x0, 2.66, z1 - z0, 0x9b9b95);        // slab, top at y=0.03
    S.box(cx, 0.045, cz, x1 - x0 - 0.2, 0.03, z1 - z0 - 0.2, 0x8a8a86); // top skin
    S.box(cx, 0.4, z1 - 0.3, x1 - x0, 0.8, 0.6, 0x77777a);        // curb
    S.box(cx, 0.08, z1 - 1.6, x1 - x0 - 1, 0.03, 0.25, 0xe8c020); // yellow edge line
    for (let x = x0 + 4; x < x1; x += 14) S.cyl(x, 0.05, z1 - 2.4, 0.22, 0.28, 0.55, 0x222226, 6);
    this._box(x0 - 0.5, WALL, x0, z1 + 0.6, 1.9);                 // sides + front, so nobody walks into the water
    this._box(x1, WALL, x1 + 0.5, z1 + 0.6, 1.9);
    this._box(x0, z1, x1, z1 + 0.6, 1.9);

    // portal cranes
    const steel = 0x3c6fa8, light = 0xd9dcde;
    for (const xc of [72, 120]) {
      const za = H + 30.5, zb = H + 43, zm = (za + zb) / 2;
      for (const sx of [-5, 5]) for (const zz of [za, zb]) {
        S.box(xc + sx, 8, zz, 1.2, 16, 1.2, steel);
        this._box(xc + sx - 0.6, zz - 0.6, xc + sx + 0.6, zz + 0.6, 16, 'crane');
      }
      for (const zz of [za, zb]) S.box(xc, 16.6, zz, 11.4, 1.2, 1.2, steel);
      for (const sx of [-5, 5]) {
        S.box(xc + sx, 16.6, zm, 1.2, 1.2, zb - za + 1.2, steel);
        S.bar(xc + sx, 0.5, za, xc + sx, 16, zb, 0.4, light); S.bar(xc + sx, 0.5, zb, xc + sx, 16, za, 0.4, light);
      }
      S.box(xc, 18.4, H + 54, 2.0, 1.8, 64, light);                 // boom (water side to land side)
      S.box(xc, 17.2, H + 54, 0.5, 0.5, 64, steel);
      S.box(xc, 20.1, H + 33, 5.2, 3.2, 7, 0x7a7e82);               // machinery house
      S.box(xc, 20.1, H + 29.4, 5.4, 1.4, 0.1, 0x203040);
      S.bar(xc, 18, H + 36, xc, 31, H + 36, 0.5, steel);            // mast
      S.bar(xc, 31, H + 36, xc, 19, H + 86, 0.3, 0x8a8f94);         // stay to the boom tip
      S.bar(xc, 31, H + 36, xc, 19, H + 24, 0.3, 0x8a8f94);         // back stay
      S.box(xc, 17.0, H + 68, 3.0, 1.6, 3.4, 0xe8a020);             // trolley with spreader
      S.box(xc, 12, H + 68, 0.3, 8.2, 0.3, 0x222226);
      S.box(xc, 8, H + 68, 2.5, 0.4, 5.8, 0x222226);
      S.box(xc, 31.4, H + 36, 0.5, 0.8, 0.5, 0xff2020);             // red beacon (see lamps)
      S.box(xc, 31.9, H + 36, 0.7, 0.7, 0.7, 0xff5040);
    }
    this._ship(S);

    // containers: instanced stacks on the quay (with colliders) + on the ship deck (no colliders)
    const spots = []; // [x, y, z, colorIndex, yaw]
    const blocks = [[40, 62], [78, 112], [128, 150]], rows = [H + 33.2, H + 36, H + 38.8];
    for (const [bx0, bx1] of blocks) for (const rz of rows) {
      for (let x = bx0; x + CONTAINER.L <= bx1 + 0.5; x += CONTAINER.L + 0.3) {
        if (rnd() < 0.18) continue;
        const stack = 1 + (rnd() < 0.55 ? 1 : 0) + (rnd() < 0.25 ? 1 : 0);
        const col = (rnd() * CONTAINER_COLORS.length) | 0;
        for (let k = 0; k < stack; k++) spots.push([x + CONTAINER.L / 2, 0.03 + CONTAINER.Hh * (k + 0.5), rz, (col + k * 3) % CONTAINER_COLORS.length]);
        this._box(x, rz - CONTAINER.W / 2, x + CONTAINER.L, rz + CONTAINER.W / 2, 0.03 + stack * CONTAINER.Hh, 'container');
      }
    }
    const deckY = 3.5, shipZ = H + 61;
    for (let bay = 0; bay < 5; bay++) for (let r = -3; r <= 2; r++) {
      if (rnd() < 0.12) continue;
      const stack = 1 + (rnd() < 0.6 ? 1 : 0) + (rnd() < 0.3 ? 1 : 0);
      const col = (rnd() * CONTAINER_COLORS.length) | 0;
      for (let k = 0; k < stack; k++) spots.push([68 + bay * 12.6, deckY + CONTAINER.Hh * (k + 0.5), shipZ + (r + 0.5) * 2.6, (col + k * 5) % CONTAINER_COLORS.length]);
    }
    const geo = new THREE.BoxGeometry(CONTAINER.L, CONTAINER.Hh, CONTAINER.W);
    const mat = new THREE.MeshStandardMaterial({ map: TX.makeContainer(8), roughness: 0.6, metalness: 0 });
    const inst = new THREE.InstancedMesh(geo, mat, spots.length);
    const d = new THREE.Object3D(), c = new THREE.Color();
    spots.forEach(([x, y, z, ci], k) => {
      d.position.set(x, y, z); d.updateMatrix(); inst.setMatrixAt(k, d.matrix);
      c.setHex(CONTAINER_COLORS[ci]); c.multiplyScalar(0.8 + ((k * 37) % 10) / 25); inst.setColorAt(k, c);
    });
    inst.castShadow = true; inst.receiveShadow = true; inst.computeBoundingSphere();
    this.group.add(inst);
    this.containers = inst;
  }

  _ship(S) {
    const zc = H + 61, x0 = 44, x1 = 140, len = x1 - x0, midX = (x0 + x1) / 2;
    const glass = 0x3b5f7a, mull = 0x23303a, white = 0xe8e8e4;
    // hull: lower part red below the waterline, dark blue above; the bow is a curved taper (stem) that rises towards the tip
    const hullPart = (y0, y1, col) => {
      S.add(new THREE.BoxGeometry(len - 14, y1 - y0, 20), col, new THREE.Matrix4().makeTranslation(midX - 7, (y0 + y1) / 2, zc));
      const bow = new THREE.BoxGeometry(16, y1 - y0, 20, 8, 1, 1);
      const p = bow.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = (p.getX(i) + 8) / 16, t = u < 0.3 ? 0 : (u - 0.3) / 0.7;
        p.setZ(i, p.getZ(i) * (1 - 0.94 * Math.pow(t, 1.5)));
        if (y1 > 0 && p.getY(i) > 0) p.setY(i, p.getY(i) + 1.6 * t * t);
      }
      bow.computeVertexNormals();
      S.add(bow, col, new THREE.Matrix4().makeTranslation(x1 - 8 - 0.01, (y0 + y1) / 2, zc));
    };
    hullPart(-6, -0.7, 0x7a1c1c); hullPart(-0.7, 3.5, 0x3a5580);
    S.box(midX - 7, -0.55, zc, len - 14, 0.3, 20.1, white);          // waterline stripe
    S.box(midX - 7, 3.55, zc, len - 14, 0.1, 19.6, 0x6a6f72);        // main deck
    // superstructure: three tiers, window bands on every side, mullions
    S.box(x0 + 7, 8.5, zc, 12, 10, 17.4, white);                      // tier 1 (y 3.5..13.5)
    S.box(x0 + 7, 15.5, zc, 10, 4, 16, white);                        // tier 2 (13.5..17.5)
    S.box(x0 + 7, 19, zc, 7, 3, 16.6, white);                         // bridge (17.5..20.5), wider than tier 2 like a real wing
    S.box(x0 + 7, 20.6, zc, 7.6, 0.3, 17.2, 0x8a8f94);                // bridge roof
    const band = (cx, cy, cz, w, h, d, along) => { // window band with mullions; along = 'x' | 'z'
      S.box(cx, cy, cz, along === 'x' ? w : d, h, along === 'x' ? d : w, glass);
      for (let k = -w / 2 + 0.75; k < w / 2; k += 1.5) S.box(along === 'x' ? cx + k : cx, cy, along === 'x' ? cz : cz + k, along === 'x' ? 0.12 : d + 0.02, h + 0.02, along === 'x' ? d + 0.02 : 0.12, mull);
    };
    for (const sg of [-1, 1]) {
      for (const y of [6.2, 8.8, 11.4]) band(x0 + 7, y, zc + sg * 8.72, 10.5, 1.0, 0.06, 'x');
      band(x0 + 7, 15.5, zc + sg * 8.02, 8.5, 1.1, 0.06, 'x');
      band(x0 + 7, 19.2, zc + sg * 8.32, 6.2, 1.3, 0.06, 'x');
    }
    band(x0 + 10.52, 19.2, zc, 15.5, 1.3, 0.06, 'z');                 // bridge front
    band(x0 + 13.03, 8.8, zc, 15, 1.0, 0.06, 'z'); band(x0 + 13.03, 11.4, zc, 15, 1.0, 0.06, 'z');
    // funnel with colour bands, masts, deck cranes
    S.box(x0 + 3.5, 23.4, zc, 3.4, 3.2, 3.0, 0xb22a2a); S.box(x0 + 3.5, 25.3, zc, 3.5, 0.7, 3.1, white); S.box(x0 + 3.5, 26.2, zc, 3.4, 1.1, 3.0, 0x1b1b1e);
    S.box(x0 + 7, 22.8, zc, 0.3, 2.5, 0.3, 0x777c80); S.box(x0 + 7, 23.6, zc, 3.2, 0.12, 0.12, 0x777c80); // radar mast
    S.box(x1 - 6, 6.2, zc, 0.5, 4.8, 0.5, 0x777c80);
    for (const x of [78, 104]) { S.box(x, 9, zc + 9.2, 0.5, 11, 0.5, 0xd8a020); S.bar(x, 14, zc + 9.2, x, 8, zc + 3, 0.3, 0xd8a020); } // deck derricks
    // railing along both sides and around the bow
    for (const sg of [-1, 1]) {
      const zr = zc + sg * 9.85;
      S.box(midX - 7 + 2, 4.7, zr, len - 18, 0.08, 0.08, white);
      S.box(midX - 7 + 2, 4.2, zr, len - 18, 0.06, 0.06, white);
      for (let x = x0 + 14; x < x1 - 16; x += 3) S.box(x, 4.1, zr, 0.08, 1.1, 0.08, white);
    }
    S.box(x1 - 24, 4.7, zc - 7, 0.08, 0.08, 14, white);
  }

  // ---------------------------------------------------------------- boats
  _boatGeo(name, fallback) {
    const root = getModel(name);
    if (!root) return fallback();
    root.updateMatrixWorld(true);
    const list = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      src.applyMatrix4(o.matrixWorld);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', src.attributes.position); g.setAttribute('normal', src.attributes.normal);
      const col = o.material?.color || new THREE.Color(0xcccccc), n = src.attributes.position.count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      list.push(g);
    });
    return list.length ? mergeGeometries(list) : fallback();
  }

  _boats() {
    const fb = (L, B, cab, col) => () => {
      const P = new Parts();
      P.box(0, 0.25, 0, B, 1.0, L, col); P.box(0, 1.0, -L * 0.1, B * 0.6, cab, L * 0.3, 0xe8e4d8);
      return P.build();
    };
    const types = [
      { name: 'prop_boat_skiff', geo: this._boatGeo('prop_boat_skiff', fb(5.2, 1.9, 0.8, 0xe8e8e0)) },
      { name: 'prop_boat_sail', geo: this._boatGeo('prop_boat_sail', fb(9.5, 3, 1.4, 0xe8e8e0)) },
      { name: 'prop_boat_yacht', geo: this._boatGeo('prop_boat_yacht', fb(13, 4.3, 2.2, 0xf0f0ec)) },
    ];
    // [type, x, z (relative to H), heading, lift]
    const spec = [
      [0, -7.4, 44, 0.04], [1, 7.8, 58, -0.02], [2, -8.6, 78, 0.03], [0, 7.0, 92, 3.0], [1, -24, 84, 0.5],
      [2, 26, 100, -0.6], [0, -40, 40, 1.3], [1, -60, 70, 0.2],
    ];
    // all boats baked into ONE dynamic mesh (1 draw call); positions are rewritten every frame from the wave surface
    this.boats = [];
    const geos = [], base = [];
    for (const s of spec) {
      const g = types[s[0]].geo.clone();
      const n = g.attributes.position.count;
      this.boats.push({ x: s[1], z: H + s[2], heading: s[3], phase: this.boats.length * 1.7 + s[0], from: geos.length ? base[base.length - 1].to : 0, to: 0 });
      const bt = this.boats[this.boats.length - 1]; bt.to = bt.from + n;
      geos.push(g); base.push(bt);
    }
    const merged = mergeGeometries(geos);
    this._pos0 = merged.attributes.position.array.slice(); this._nor0 = merged.attributes.normal.array.slice();
    merged.attributes.position.setUsage(THREE.DynamicDrawUsage); merged.attributes.normal.setUsage(THREE.DynamicDrawUsage);
    this.boatMesh = new THREE.Mesh(merged, this.solidMat);
    this.boatMesh.frustumCulled = false; this.boatMesh.castShadow = false;
    this.group.add(this.boatMesh);
    this._d = new THREE.Object3D(); this._d.rotation.order = 'YXZ';
    this._surf = { h: 0, gx: 0, gz: 0 };
    this._v = new THREE.Vector3();
  }

  // Deck height of the pier / T-head / quay at (x,z), else null. With flag=true returns a boolean (walkable on a deck).
  deckHeightAt(x, z, flag = false) {
    const P = PIER, Q = QUAY;
    let h = null;
    if (Math.abs(x) <= P.hw && z >= P.z0 && z <= P.zHead) h = 0.06;
    else if (Math.abs(x) <= P.headHW && z >= P.zHead && z <= P.zEnd) h = 0.06;
    else if (x >= Q.x0 && x <= Q.x1 && z >= Q.z0 && z <= Q.z1) h = 0.03;
    return flag ? h !== null : h;
  }

  update(dt, night) {
    this.t += dt;
    // boats ride the same waves as the water shader
    const d = this._d, s = this._surf, t = this.t;
    const pos = this.boatMesh.geometry.attributes.position, nor = this.boatMesh.geometry.attributes.normal, v = this._v;
    for (let i = 0; i < this.boats.length; i++) {
      const b = this.boats[i];
      seaSurface(b.x, b.z, t, s);
      const sh = Math.sin(b.heading), ch = Math.cos(b.heading);
      d.position.set(b.x, COAST.sea + s.h + 0.05 + Math.sin(t * 1.7 + b.phase) * 0.03, b.z);
      d.rotation.set(-Math.atan((s.gx * sh + s.gz * ch) * 3), b.heading, Math.atan((s.gx * ch - s.gz * sh) * 3) + Math.sin(t * 1.3 + b.phase) * 0.02);
      d.updateMatrix();
      const m = d.matrix;
      for (let k = b.from; k < b.to; k++) {
        v.fromArray(this._pos0, k * 3).applyMatrix4(m); pos.setXYZ(k, v.x, v.y, v.z);
        v.fromArray(this._nor0, k * 3).transformDirection(m); nor.setXYZ(k, v.x, v.y, v.z);
      }
    }
    pos.needsUpdate = true; nor.needsUpdate = true;
  }
}
