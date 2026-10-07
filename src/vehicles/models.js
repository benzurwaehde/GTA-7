// Procedural low-poly car models. Geometry is built once per type (merged, vertex-colored) and shared by all cars.
// Per car draw calls: body, headlights, taillights, front wheels, rear wheels (+2 for police light bar).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Physics + dimension spec per type. Steering: positive steer = RIGHT turn (D key).
export const SPECS = {
  sedan:  { L: 4.5, W: 1.85, top: 33, accel: 14, brake: 30, grip: 9,  maxSteer: 0.55, steerSpeed: 15, mass: 1300, wheelR: 0.34, wb: 2.7, cruise: 0.42 },
  sports: { L: 4.4, W: 1.92, top: 48, accel: 23, brake: 36, grip: 12, maxSteer: 0.5,  steerSpeed: 19, mass: 1200, wheelR: 0.33, wb: 2.6, cruise: 0.4 },
  truck:  { L: 5.4, W: 2.05, top: 26, accel: 9,  brake: 24, grip: 7,  maxSteer: 0.5,  steerSpeed: 13, mass: 2300, wheelR: 0.5,  wb: 3.4, cruise: 0.5 },
  taxi:   { L: 4.5, W: 1.85, top: 34, accel: 15, brake: 30, grip: 9,  maxSteer: 0.55, steerSpeed: 15, mass: 1300, wheelR: 0.34, wb: 2.7, cruise: 0.45 },
  police: { L: 4.7, W: 1.9,  top: 43, accel: 21, brake: 34, grip: 10, maxSteer: 0.55, steerSpeed: 17, mass: 1500, wheelR: 0.35, wb: 2.8, cruise: 0.45 },
};

export const PAINTS = [0xc0392b, 0x2980b9, 0x27ae60, 0xecf0f1, 0x2c3e50, 0x8e44ad, 0xe67e22, 0x7f8c8d, 0x16a085, 0xd35400, 0xff3d7f, 0x1abc9c, 0xb8c1c8, 0x34495e];

const GLASS = 0x10151c, DARK = 0x16181b, WHITE = 0xffffff;

class Builder {
  constructor() { this.parts = []; }
  box(w, h, d, x, y, z, color = WHITE) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    this.color(g, color);
    this.parts.push(g);
    return this;
  }
  color(g, color) {
    const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  }
  build() { return mergeGeometries(this.parts, false); }
}

function wheelPair(r, track, width = 0.26) {
  const b = new Builder();
  for (const s of [-1, 1]) {
    const tire = new THREE.CylinderGeometry(r, r, width, 14);
    tire.rotateZ(Math.PI / 2); tire.translate(s * track, 0, 0);
    b.color(tire, 0x1a1a1c); b.parts.push(tire);
    b.box(width + 0.03, r * 1.15, 0.09, s * track, 0, 0, 0xaab0b6);
    b.box(width + 0.03, 0.09, r * 1.15, s * track, 0, 0, 0xaab0b6);
  }
  return b.build();
}

const cache = {};

function buildGeometries(type) {
  const s = SPECS[type];
  const { L, W } = s, r = s.wheelR;
  const body = new Builder(), head = new Builder(), tail = new Builder();
  let zf, zr, track = W / 2 - 0.1;
  const bumper = (h, y) => {
    body.box(W + 0.03, h, 0.22, 0, y, L / 2 - 0.05, DARK);
    body.box(W + 0.03, h, 0.22, 0, y, -L / 2 + 0.05, DARK);
  };

  if (type === 'truck') {
    zf = 1.9; zr = -1.5;
    body.box(W - 0.1, 0.25, L - 0.3, 0, 0.5, 0, DARK);
    body.box(W, 0.75, 1.3, 0, 0.93, 2.0);                 // hood
    body.box(W, 0.8, 1.6, 0, 0.95, 0.55);                  // cab lower
    body.box(W * 0.93, 0.62, 1.4, 0, 1.66, 0.55, GLASS);   // cab glass
    body.box(W * 0.9, 0.1, 1.5, 0, 2.02, 0.55);            // roof
    for (const sx of [-1, 1]) for (const sz of [1.2, -0.1]) body.box(0.1, 0.62, 0.1, sx * W * 0.45, 1.66, sz);
    body.box(W, 0.2, 2.4, 0, 0.8, -1.55);                  // bed floor
    for (const sx of [-1, 1]) body.box(0.1, 0.5, 2.4, sx * (W / 2 - 0.05), 1.15, -1.55);
    body.box(W, 0.5, 0.1, 0, 1.15, -2.7);
    body.box(W, 0.5, 0.1, 0, 1.15, -0.4);
    body.box(W + 0.05, 0.35, 0.25, 0, 0.6, L / 2 - 0.05, DARK);
    body.box(W + 0.05, 0.3, 0.25, 0, 0.6, -L / 2 + 0.05, DARK);
    for (const sx of [-1, 1]) {
      head.box(0.4, 0.2, 0.06, sx * W * 0.32, 0.95, L / 2 + 0.01);
      tail.box(0.3, 0.22, 0.06, sx * W * 0.4, 1.05, -L / 2 - 0.01);
    }
  } else if (type === 'sports') {
    zf = L * 0.3; zr = -L * 0.3;
    body.box(W - 0.1, 0.15, L - 0.3, 0, 0.35, 0, DARK);
    body.box(W, 0.45, L, 0, 0.6, 0);
    body.box(W * 0.94, 0.12, L * 0.34, 0, 0.88, L * 0.28);   // hood bulge
    body.box(W * 0.9, 0.36, L * 0.38, 0, 1.0, -0.35, GLASS);
    body.box(W * 0.84, 0.07, L * 0.34, 0, 1.22, -0.35);
    body.box(0.34, 0.02, L, 0, 0.84, 0, DARK);                 // racing stripe
    for (const sx of [-1, 1]) body.box(0.07, 0.07, 0.5, sx * W * 0.35, 1.1, -L / 2 + 0.25, DARK).box(0.07, 0.3, 0.07, sx * W * 0.3, 0.95, -L / 2 + 0.3, DARK);
    body.box(W * 0.95, 0.06, 0.45, 0, 1.15, -L / 2 + 0.25, DARK); // spoiler
    bumper(0.22, 0.38);
    for (const sx of [-1, 1]) {
      head.box(0.42, 0.1, 0.06, sx * W * 0.33, 0.66, L / 2 + 0.01);
      tail.box(0.46, 0.1, 0.06, sx * W * 0.32, 0.7, -L / 2 - 0.01);
    }
  } else {
    // sedan / taxi / police share the sedan silhouette
    zf = L * 0.3; zr = -L * 0.3;
    const police = type === 'police';
    const lower = police ? 0x15171a : WHITE;
    body.box(W - 0.1, 0.2, L - 0.3, 0, 0.35, 0, DARK);
    body.box(W, 0.55, L, 0, 0.625, 0, lower);
    body.box(W * 0.92, 0.45, L * 0.48, 0, 1.125, -0.2, GLASS);
    body.box(W * 0.88, 0.08, L * 0.44, 0, 1.39, -0.2, police ? 0x15171a : WHITE);
    for (const sx of [-1, 1]) for (const sz of [0.0, -0.4]) body.box(0.08, 0.45, 0.08, sx * W * 0.45, 1.125, sz + (sz === 0 ? L * 0.2 - 0.1 : -L * 0.2 - 0.1), police ? 0x15171a : WHITE);
    bumper(0.25, 0.45);
    if (police) {
      body.box(W + 0.02, 0.5, L * 0.2, 0, 0.65, 0.5, WHITE).box(W + 0.02, 0.5, L * 0.2, 0, 0.65, -0.6, WHITE); // door panels
      body.box(1.0, 0.07, 0.32, 0, 1.47, -0.2, DARK); // light bar base
    }
    if (type === 'taxi') {
      body.box(W + 0.02, 0.07, L * 0.92, 0, 0.72, 0, DARK);   // side stripe
      body.box(0.7, 0.2, 0.3, 0, 1.53, -0.2, 0xfff7c0);        // roof sign
    }
    for (const sx of [-1, 1]) {
      head.box(0.38, 0.14, 0.06, sx * W * 0.33, 0.72, L / 2 + 0.01);
      tail.box(0.42, 0.14, 0.06, sx * W * 0.33, 0.74, -L / 2 - 0.01);
    }
  }
  const out = {
    body: body.build(), head: head.build(), tail: tail.build(),
    wheelF: wheelPair(r, track), wheelR: wheelPair(r, track), zf, zr,
  };
  if (type === 'police') {
    const red = new Builder().box(0.42, 0.14, 0.3, 0.27, 1.55, -0.2, WHITE);
    const blue = new Builder().box(0.42, 0.14, 0.3, -0.27, 1.55, -0.2, WHITE);
    out.red = red.build(); out.blue = blue.build();
  }
  return out;
}

const bodyMats = new Map();
export function paintMaterial(hex) {
  let m = bodyMats.get(hex);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: hex, vertexColors: true, roughness: 0.45, metalness: 0.25 }); bodyMats.set(hex, m); }
  return m;
}
export const MATS = {
  burnt: new THREE.MeshStandardMaterial({ color: 0x1c1c1c, vertexColors: true, roughness: 0.95, metalness: 0 }),
  wheel: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9 }),
  head: new THREE.MeshBasicMaterial({ color: 0xfff0b8, vertexColors: false }),
  tailOff: new THREE.MeshBasicMaterial({ color: 0x5a0c0c }),
  tailOn: new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
  off: new THREE.MeshBasicMaterial({ color: 0x050505 }),
  redOn: new THREE.MeshBasicMaterial({ color: 0xff2020 }),
  redOff: new THREE.MeshBasicMaterial({ color: 0x400808 }),
  blueOn: new THREE.MeshBasicMaterial({ color: 0x2f6bff }),
  blueOff: new THREE.MeshBasicMaterial({ color: 0x081844 }),
};
// Geometry vertex colors baked on head/tail geometries are white; tint via material colour.

export function buildCarModel(type, paint) {
  const g = cache[type] || (cache[type] = buildGeometries(type));
  const root = new THREE.Group();
  const chassis = new THREE.Group();
  root.add(chassis);
  const body = new THREE.Mesh(g.body, type === 'police' ? paintMaterial(0xffffff) : paintMaterial(paint));
  body.castShadow = true;
  const head = new THREE.Mesh(g.head, MATS.head);
  const tail = new THREE.Mesh(g.tail, MATS.tailOff);
  chassis.add(body, head, tail);
  const r = SPECS[type].wheelR;
  const mk = (geo, z, steer) => {
    const grp = new THREE.Group(); grp.position.set(0, r, z);
    const spin = new THREE.Mesh(geo, MATS.wheel); grp.add(spin); chassis.add(grp);
    return { grp, spin };
  };
  const wf = mk(g.wheelF, g.zf), wr = mk(g.wheelR, g.zr);
  const m = { root, chassis, body, head, tail, wheelFGroup: wf.grp, wheelF: wf.spin, wheelR: wr.spin };
  if (g.red) {
    m.red = new THREE.Mesh(g.red, MATS.redOff); m.blue = new THREE.Mesh(g.blue, MATS.blueOff);
    chassis.add(m.red, m.blue);
  }
  return m;
}
