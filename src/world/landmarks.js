import * as THREE from 'three';
import { Parts } from './parts.js';
import { CITY } from '../core/config.js';

// Landmarks. Each one is a single merged mesh (or two when something moves):
//  - Meridian Tower: 188 m glass tower with setbacks and a lit spire in the central plaza park (built into the city's
//    facade / roof geometry, no extra draw call)
//  - Marlin Wheel: Ferris wheel on the south beach (static frame, rotating wheel, 12 instanced gondolas, bulbs)
//  - Pier Light: striped lighthouse at the east end of the south beach with a rotating night beam
//  - Ashgrove Pavilion: octagonal gazebo in the first pond-free park of Ashgrove Heights (north)
const H = CITY.half;
const SLAB = 0.18;
const GONDOLAS = 12;

export class Landmarks {
  constructor(group, colliders) {
    this.group = group; this.colliders = colliders;
    this.t = 0; this.night = 0;
    this.solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 });
    this._ferris();
    this._lighthouse();
    this.list = [
      { name: 'Meridian Tower', x: -37, z: 37, type: 'tower' },
      { name: 'Marlin Wheel', x: this.wheel.x, z: this.wheel.z, type: 'wheel' },
      { name: 'Pier Light', x: this.light.x, z: this.light.z, type: 'lighthouse' },
    ];
    this.update(0, 0);
    this.gondolas.computeBoundingSphere();
  }

  _box(x0, z0, x1, z1, maxY, type = 'landmark') { this.colliders.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, maxY, type }); }

  // ---------------------------------------------------------------- tower (merged into the facade / roof builders)
  buildTower(F, R, cx, cz) {
    const tint = [0.8, 0.9, 1.0], steel = [0.72, 0.75, 0.8], dark = [0.2, 0.22, 0.26];
    const tiers = [[9, 120], [7, 160], [5, 188]]; // [half width, top height]
    let y0 = SLAB;
    tiers.forEach(([hw, top], i) => {
      F.box(cx - hw, y0, cz - hw, cx + hw, top, cz + hw, tint, { mode: 'facade', uoff: 0.31 * i, top: false });
      R.box(cx - hw - 0.3, top, cz - hw - 0.3, cx + hw + 0.3, top + 0.8, cz + hw + 0.3, steel, { mode: 'world' });
      y0 = top;
    });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { // corner fins on the lower tier
      R.box(cx + sx * 9 - 0.6 + (sx > 0 ? 0.4 : -0.4), SLAB, cz + sz * 9 - 0.6 + (sz > 0 ? 0.4 : -0.4),
        cx + sx * 9 + 0.6 + (sx > 0 ? 0.4 : -0.4), 120, cz + sz * 9 + 0.6 + (sz > 0 ? 0.4 : -0.4), steel, { mode: 'world', top: false });
    }
    R.box(cx - 3, 188.8, cz - 3, cx + 3, 196, cz + 3, dark, { mode: 'world' });
    R.box(cx - 0.3, 196, cz - 0.3, cx + 0.3, 232, cz + 0.3, steel, { mode: 'world' });
    R.box(cx - 0.45, 232, cz - 0.45, cx + 0.45, 233, cz + 0.45, [1, 0.15, 0.12], { mode: 'world' });
    // bands of light along the crown edge (read at night because the roof material is unlit-ish grey, so keep it subtle)
    this._box(cx - 10.2, cz - 10.2, cx + 10.2, cz + 10.2, 190, 'building'); // includes the corner fins
    return [cx, 233.5, cz];
  }

  // ---------------------------------------------------------------- Ferris wheel
  _ferris() {
    const X = -48, Z = H + 14, HUB = 18, RAD = 15.5;
    this.wheel = { x: X, z: Z, hub: HUB, r: RAD };
    const steel = 0xe8eaee, accent = 0x2b6fb5;
    // static frame
    const S = new Parts();
    for (const sz of [-1, 1]) {
      for (const sx of [-1, 1]) {
        S.bar(X + sx * 0.3, HUB, Z + sz * 2.0, X + sx * 8, 0.3, Z + sz * 3.8, 0.7, steel);
        this._box(X + sx * 8 - 0.7, Z + sz * 3.8 - 0.7, X + sx * 8 + 0.7, Z + sz * 3.8 + 0.7, 6, 'landmark');
      }
      S.box(X, 0.3, Z + sz * 3.8, 17, 0.6, 1.2, accent);
    }
    S.box(X, HUB, Z, 1.0, 1.0, 5.4, accent);
    S.box(X + 12, 1.4, Z + 8, 4, 2.8, 3.2, 0xd8b030); S.box(X + 12, 3.0, Z + 8, 4.6, 0.3, 3.8, 0xb03030);
    this._box(X + 10, Z + 6.4, X + 14, Z + 9.6, 3, 'landmark');
    const st = new THREE.Mesh(S.build(), this.solidMat);
    st.castShadow = false; st.receiveShadow = true; this.group.add(st);

    // rotating wheel + bulbs (children of one group at the hub)
    const Wp = new Parts(), Bp = new Parts(), n = 24;
    const pt = (i, r) => [Math.cos(i / n * Math.PI * 2) * r, Math.sin(i / n * Math.PI * 2) * r];
    for (const sz of [-1.8, 1.8]) {
      for (let i = 0; i < n; i++) {
        const [ax, ay] = pt(i, RAD), [bx, by] = pt(i + 1, RAD), [ix, iy] = pt(i, RAD * 0.5), [jx, jy] = pt(i + 1, RAD * 0.5);
        Wp.bar(ax, ay, sz, bx, by, sz, 0.4, steel);
        Wp.bar(ix, iy, sz, jx, jy, sz, 0.25, steel);
        const [ox, oy] = pt(i, RAD + 0.35);
        Bp.box(ox, oy, sz, 0.5, 0.5, 0.5, 0xffffff);
        if (i % 2 === 0) {
          Wp.bar(0, 0, sz, ax, ay, sz, 0.22, i % 4 === 0 ? accent : steel);
          for (const f of [0.35, 0.6, 0.85]) { const [sx, sy] = pt(i, RAD * f); Bp.box(sx, sy, sz, 0.34, 0.34, 0.34, 0xffffff); } // string lights on the spokes
        }
      }
    }
    for (let i = 0; i < n; i += 2) { const [ax, ay] = pt(i, RAD); Wp.bar(ax, ay, -1.8, ax, ay, 1.8, 0.3, accent); }
    this.wheelGroup = new THREE.Group();
    this.wheelGroup.position.set(X, HUB, Z);
    const wm = new THREE.Mesh(Wp.build(), this.solidMat);
    wm.receiveShadow = true;
    this.bulbMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x3c3830 });
    this.wheelGroup.add(wm, new THREE.Mesh(Bp.build(), this.bulbMat));
    this.group.add(this.wheelGroup);

    // gondolas: stay upright, so they are instanced and positioned on the rim every frame
    const G = new Parts();
    G.box(0, 0, 0, 2.2, 1.5, 2.2, 0xffffff); G.box(0, 0.85, 0, 2.5, 0.22, 2.5, 0xffffff); G.box(0, 0.15, 1.12, 2.0, 0.7, 0.05, 0x203040);
    G.box(0, 0.15, -1.12, 2.0, 0.7, 0.05, 0x203040); G.bar(0, 0.9, 0, 0, 1.9, 0, 0.12, 0x555a60);
    this.gondolas = new THREE.InstancedMesh(G.build(), this.solidMat, GONDOLAS);
    const cols = [0xd8402a, 0x2a7ad8, 0xf0c030, 0x38a85a, 0xc050c0, 0xf08a30];
    const c = new THREE.Color();
    for (let i = 0; i < GONDOLAS; i++) this.gondolas.setColorAt(i, c.setHex(cols[i % cols.length]));
    this.gondolas.castShadow = false;
    this.group.add(this.gondolas);
    this._d = new THREE.Object3D();
    this.angle = 0;
  }

  // ---------------------------------------------------------------- lighthouse
  _lighthouse() {
    const X = 205, Z = H + 20, S = new Parts();
    this.light = { x: X, z: Z, h: 36 };
    S.box(X, 0.4, Z, 12, 0.8, 12, 0x9a9a94);
    S.box(X - 6.5, 2.3, Z + 7, 6, 4.6, 5, 0xe8e2d0); S.box(X - 6.5, 4.9, Z + 7, 7, 0.6, 6, 0xa03a2a);   // keeper's house
    const stripes = 7, sh = 4.4;
    for (let i = 0; i < stripes; i++) {
      const r0 = 3.4 - i * 0.2, r1 = 3.4 - (i + 1) * 0.2;
      S.cyl(X, 0.8 + i * sh, Z, r1, r0, sh, i % 2 ? 0xf2f0ea : 0xc83a2c, 12);
    }
    const gy = 0.8 + stripes * sh;                      // gallery
    S.cyl(X, gy, Z, 3.3, 2.6, 0.6, 0x2a2e34, 12);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; S.box(X + Math.cos(a) * 3.2, gy + 1.1, Z + Math.sin(a) * 3.2, 0.1, 1.0, 0.1, 0x2a2e34); }
    S.cyl(X, gy + 0.6, Z, 1.9, 1.9, 0.5, 0xc83a2c, 12);
    S.cyl(X, gy + 3.5, Z, 0.2, 2.1, 1.8, 0xc83a2c, 12);   // roof
    S.sphere(X, gy + 5.5, Z, 0.35, 0x2a2e34);
    S.cyl(X, gy + 1.1, Z, 1.5, 1.5, 2.4, 0xfff4c0, 10);   // lantern room (the beam shows at night)
    const mesh = new THREE.Mesh(S.build(), this.solidMat);
    mesh.castShadow = true; mesh.receiveShadow = true; this.group.add(mesh);
    this._box(X - 3.6, Z - 3.6, X + 3.6, Z + 3.6, gy, 'landmark');
    this._box(X - 9.5, Z + 4.5, X - 3.5, Z + 9.5, 5, 'building');
    // rotating beam: two long additive cones, only visible at night
    const mk = (flip) => { const g = new THREE.ConeGeometry(7, 90, 12, 1, true); g.translate(0, -45, 0); g.rotateZ(Math.PI / 2); if (flip) g.rotateY(Math.PI); return g; };
    const geo = new THREE.BufferGeometry(); // merge the two cones by hand (same attribute layout)
    const a = mk(false).toNonIndexed(), b = mk(true).toNonIndexed();
    const pos = new Float32Array(a.attributes.position.count * 3 * 2);
    pos.set(a.attributes.position.array, 0); pos.set(b.attributes.position.array, a.attributes.position.array.length);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const nv = pos.length / 3, col = new Float32Array(nv * 4); // alpha fades from the lantern to the far end (no hard rim)
    for (let i = 0; i < nv; i++) { const t = Math.min(1, Math.abs(pos[i * 3]) / 90); col.set([1, 1, 1, Math.pow(1 - t, 1.6)], i * 4); }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    this.beamMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xfff2b8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.beam = new THREE.Mesh(geo, this.beamMat);
    this.beam.position.set(X, gy + 2.3, Z); this.beam.frustumCulled = false; this.beam.visible = false; this.beam.renderOrder = 6;
    this.group.add(this.beam);
  }

  // ---------------------------------------------------------------- pavilion
  addPavilion(cx, cz) {
    const P = new Parts(), n = 8, R = 4.4, y = SLAB + 0.02;
    P.cyl(cx, y, cz, 4.9, 5.1, 0.35, 0xcbc4b4, n);
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n * Math.PI * 2, px = cx + Math.cos(a) * R, pz = cz + Math.sin(a) * R;
      P.cyl(px, y + 0.35, pz, 0.17, 0.2, 3.3, 0xf2efe6, 6);
      this._box(px - 0.3, pz - 0.3, px + 0.3, pz + 0.3, 4, 'landmark');
      if (i % 2 === 1) P.box(cx + Math.cos(a) * (R - 0.6), y + 0.8, cz + Math.sin(a) * (R - 0.6), 2.9, 0.12, 0.55, 0x8a5a30, -a + Math.PI / 2);
    }
    P.cyl(cx, y + 3.65, cz, 5.4, 5.4, 0.25, 0xf2efe6, n);
    P.cyl(cx, y + 3.9, cz, 0.3, 5.7, 2.3, 0x9a3b2c, n);
    P.cyl(cx, y + 6.2, cz, 0.05, 0.3, 0.9, 0xd8b030, 6);
    const mesh = new THREE.Mesh(P.build(), this.solidMat);
    mesh.castShadow = true; mesh.receiveShadow = true; this.group.add(mesh);
    this.list.push({ name: 'Ashgrove Pavilion', x: cx, z: cz, type: 'pavilion' });
  }

  setNight(night) {
    this.night = night;
    this.bulbMat.color.setHSL((this.t * 0.05) % 1, 0.8, 0.6).multiplyScalar(night * 1.2).add(_dim.set(0x3c3830).multiplyScalar(1 - night));
    this.beamMat.opacity = 0.14 * night; this.beam.visible = night > 0.03;
  }

  update(dt, night) {
    this.t += dt;
    this.angle += dt * 0.06;
    this.wheelGroup.rotation.z = this.angle;
    const w = this.wheel, d = this._d;
    for (let i = 0; i < GONDOLAS; i++) {
      const a = this.angle + i / GONDOLAS * Math.PI * 2;
      d.position.set(w.x + Math.cos(a) * w.r, w.hub + Math.sin(a) * w.r - 1.55, w.z);
      d.rotation.set(0, 0, Math.sin(this.t * 0.8 + i) * 0.02);
      d.updateMatrix(); this.gondolas.setMatrixAt(i, d.matrix);
    }
    this.gondolas.instanceMatrix.needsUpdate = true;
    this.beam.rotation.y += dt * 0.7;
    this.setNight(night);
  }
}
const _dim = new THREE.Color();
