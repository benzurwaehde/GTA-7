// Visible car damage, done on a private copy of the (shared) body geometry that is cloned on the first hit:
//   dent()        vertex offset around the contact point + darkened paint, faces re-shaded flat so it reads as crumpled
//   breakGlass()  window vertices get a cracked, milky look
//   char()        burnt-out wreck: charcoal colours, black windows, sagging roof
// Nothing here runs per frame; every call is triggered by an impact or a damage threshold.
import * as THREE from 'three';

const _g = new THREE.Color(0x10151c);
const GR = _g.r, GG = _g.g, GB = _g.b;
const MAX_DENT = 0.45;

const isGlass = (c, i) => Math.abs(c[i] - GR) < 2e-4 && Math.abs(c[i + 1] - GG) < 2e-4 && Math.abs(c[i + 2] - GB) < 2e-4;
// Deterministic hash in 0..1 for a position, so vertices that share a spot always move together (no cracks).
const hash3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };

// Clones the body geometry once per vehicle and keeps the pristine positions/colours.
function own(model) {
  const mesh = model.body;
  if (mesh.userData.own) return mesh.geometry;
  const g = mesh.geometry.clone();
  g.userData.orig = Float32Array.from(g.attributes.position.array);
  g.userData.col = Float32Array.from(g.attributes.color.array);
  mesh.geometry = g;
  mesh.userData.own = true;
  return g;
}

export function disposeDamage(model) {
  if (model.body.userData.own) { model.body.geometry.dispose(); model.body.userData.own = false; }
}

function flatNormals(g, tris) {
  const P = g.attributes.position.array, N = g.attributes.normal.array;
  for (let t = 0; t < tris.length; t++) {
    if (!tris[t]) continue;
    const k = t * 9;
    const ax = P[k + 3] - P[k], ay = P[k + 4] - P[k + 1], az = P[k + 5] - P[k + 2];
    const bx = P[k + 6] - P[k], by = P[k + 7] - P[k + 1], bz = P[k + 8] - P[k + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (let c = 0; c < 3; c++) { N[k + c * 3] = nx; N[k + c * 3 + 1] = ny; N[k + c * 3 + 2] = nz; }
  }
  g.attributes.normal.needsUpdate = true;
}

const _tris = [];   // scratch flags (grows once, reused)

// (lx, lz): contact point in the car's local frame (x = left, z = forward). amount in metres of push.
export function dent(model, lx, lz, amount, radius) {
  const g = own(model), P = g.attributes.position.array, C = g.attributes.color.array, O = g.userData.orig;
  const n = g.attributes.position.count, tn = n / 3 | 0;
  let dx = -lx, dz = -lz; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;   // push towards the car's centre
  if (_tris.length < tn) _tris.length = tn;
  for (let t = 0; t < tn; t++) _tris[t] = false;
  const R2 = radius * radius;
  for (let i = 0; i < n; i++) {
    const k = i * 3, ex = P[k] - lx, ez = P[k + 2] - lz, d2 = ex * ex + ez * ez;
    if (d2 >= R2) continue;
    if (isGlass(C, k)) continue;
    const f = 1 - Math.sqrt(d2) / radius, w = f * f * (0.55 + 0.45 * hash3(O[k], O[k + 1], O[k + 2]));
    const m = amount * w;
    P[k] += dx * m; P[k + 2] += dz * m;
    if (P[k + 1] > 0.8) P[k + 1] -= m * 0.45;        // hood / roof crumples down as well
    const ox = P[k] - O[k], oy = P[k + 1] - O[k + 1], oz = P[k + 2] - O[k + 2], ol = Math.hypot(ox, oy, oz);
    if (ol > MAX_DENT) { const s = MAX_DENT / ol; P[k] = O[k] + ox * s; P[k + 1] = O[k + 1] + oy * s; P[k + 2] = O[k + 2] + oz * s; }
    const dark = 1 - 0.28 * f * w * 3;                // scraped, dirty paint
    C[k] *= Math.max(0.35, dark); C[k + 1] *= Math.max(0.35, dark); C[k + 2] *= Math.max(0.35, dark);
    _tris[(i / 3) | 0] = true;
  }
  g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
  flatNormals(g, _tris);
}

export function breakGlass(model) {
  const g = own(model), C = g.attributes.color.array, n = g.attributes.position.count, O = g.userData.orig;
  for (let i = 0; i < n; i += 3) {
    const k = i * 3;
    if (!isGlass(C, k)) continue;
    const h = hash3(O[k], O[k + 1], O[k + 2]) + hash3(O[k + 3], O[k + 4], O[k + 5]) * 0.5;
    const s = h > 1.1 ? 0.02 : 0.28 + 0.4 * (h % 0.5) * 2;   // a few dark holes, the rest milky shards
    for (let c = 0; c < 3; c++) { C[k + c * 3] = s * 0.75; C[k + c * 3 + 1] = s * 0.85; C[k + c * 3 + 2] = s; }
  }
  g.attributes.color.needsUpdate = true;
}

// Burnt-out shell. The wreck uses MATS.charred (white base colour), so these vertex colours are what you see.
export function char(model) {
  const g = own(model), P = g.attributes.position.array, C = g.attributes.color.array, O = g.userData.orig, n = g.attributes.position.count;
  for (let i = 0; i < n; i += 3) {
    const k = i * 3, h = hash3(O[k], O[k + 1], O[k + 2]) * 0.6 + hash3(O[k + 3], O[k + 4], O[k + 5]) * 0.4;
    const glass = isGlass(C, k), dk = C[k] + C[k + 1] + C[k + 2] < 0.06;   // trim / bumpers are already dark
    let r, gg, b;
    if (glass) { r = gg = b = 0.006; }
    else if (!dk && h > 0.8) { r = 0.11; gg = 0.05; b = 0.022; }          // rust patches
    else { const s = 0.014 + 0.05 * h; r = s * 1.05; gg = s; b = s * 0.95; }
    for (let c = 0; c < 3; c++) { C[k + c * 3] = r; C[k + c * 3 + 1] = gg; C[k + c * 3 + 2] = b; }
  }
  for (let i = 0; i < n; i++) {                       // roof and hood sag, surface gets uneven
    const k = i * 3, y = P[k + 1];
    if (y > 0.75) P[k + 1] = y - (y - 0.75) * 0.12;
    const j = hash3(O[k], O[k + 1], O[k + 2]) - 0.5;
    P[k] += j * 0.07; P[k + 1] += j * 0.05; P[k + 2] -= j * 0.06;
  }
  g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
  g.computeVertexNormals();   // non-indexed: flat faces, which suits crumpled metal
}
