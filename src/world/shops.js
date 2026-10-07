import * as THREE from 'three';
import { GB, mulberry32, rgb } from './util.js';
import { makeGlow } from './textures.js';

// Ground-floor shopfronts (window, door, awning, sign), neon blade signs and roof billboards.
// Everything is merged into 5 meshes: body, glass, signs, neon, glow pools. Uses its own RNG so the city layout is unchanged.
const SLAB = 0.18;
const NEON = ['#ff3fb4', '#30f0ff', '#ffe030', '#5cff7a', '#ff8a30', '#b070ff'];
const FIRST = ['Marlin', 'Coral', 'Vice', 'Bay', 'Neon', 'Palm', 'Sunset', 'Harbor', 'Mario', 'Lucky', 'Golden', 'Blue', 'Ruby', 'Flamingo', 'Atlas', 'Nova', 'Tropic', "Joe's", 'Big Kahuna', 'Sol'];
const KIND = ['Pizza', 'Burgers', 'Cafe', 'Records', 'Pharmacy', 'Sneakers', 'Tacos', 'Barber', 'Books', 'Sushi', 'Deli', 'Arcade', 'Tattoo', 'Laundry', 'Bakery', 'Cellular', 'Liquor', 'Diner', 'Boutique', 'Gym'];
const SIGN_COLORS = [['#1b2a49', '#ffd23f'], ['#7a1f2b', '#fff1d0'], ['#12372a', '#b6f5c9'], ['#2b2b2b', '#ff8fd1'], ['#f2e9d8', '#8a1c1c'], ['#0f4c5c', '#ffe9a8'], ['#3b1f5e', '#7dfcff'], ['#e8b923', '#22223b']];
const BASE_COLORS = [0x3a3f48, 0x5a3a32, 0x2f4a40, 0x4a4a52, 0x6a5a48, 0x32405a, 0x5a3248];
const AWN = [[0xb02828, 0x7a1a1a], [0x1d5aa8, 0x143c70], [0x2e7d32, 0x1c4d20], [0xd89a20, 0x6a4a10], [0x6a1b9a, 0x45106a], [0x00838f, 0x005560]];
const SIGN_CELL = [512, 128], SIGN_ATLAS = [2048, 1024]; // 4 x 8 = 32 names
const BLADES = ['HOTEL', 'BAR', 'CLUB', 'PIZZA', 'SUSHI', 'CASINO', '24H', 'LIVE'];
const BOARDS = ['NEON NIGHTS', 'VICE FM 104.2', 'BAY CASINO', 'COLA-X'];

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function texOf(c) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function makeSignAtlas(rnd) {
  const [c, x] = canvas(...SIGN_ATLAS);
  const names = new Set();
  while (names.size < 32) names.add(FIRST[(rnd() * FIRST.length) | 0] + ' ' + KIND[(rnd() * KIND.length) | 0]);
  [...names].forEach((nm, i) => {
    const cx = (i % 4) * SIGN_CELL[0], cy = ((i / 4) | 0) * SIGN_CELL[1];
    const [bg, fg] = SIGN_COLORS[(rnd() * SIGN_COLORS.length) | 0];
    x.fillStyle = bg; x.fillRect(cx, cy, SIGN_CELL[0], SIGN_CELL[1]);
    x.strokeStyle = fg; x.lineWidth = 4; x.strokeRect(cx + 5, cy + 5, SIGN_CELL[0] - 10, SIGN_CELL[1] - 10);
    let size = 60; x.font = `bold ${size}px Arial, Helvetica, sans-serif`;
    while (x.measureText(nm).width > SIGN_CELL[0] - 40 && size > 20) { size -= 2; x.font = `bold ${size}px Arial, Helvetica, sans-serif`; }
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(nm.toUpperCase(), cx + SIGN_CELL[0] / 2, cy + SIGN_CELL[1] / 2 + 3);
  });
  return texOf(c);
}

// 1024x1024: top half 8 vertical blades (128x512), bottom half 4 billboards (512x256).
function makeNeonAtlas() {
  const [c, x] = canvas(1024, 1024);
  x.fillStyle = '#07060c'; x.fillRect(0, 0, 1024, 1024);
  const glowText = (txt, color, cx, cy, size) => {
    x.font = `bold ${size}px Arial, Helvetica, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = color; x.shadowBlur = size * 0.5; x.fillStyle = color; x.fillText(txt, cx, cy);
    x.shadowBlur = size * 0.2; x.fillStyle = '#ffffff'; x.globalAlpha = 0.55; x.fillText(txt, cx, cy); x.globalAlpha = 1; x.shadowBlur = 0;
  };
  BLADES.forEach((w, i) => {
    const color = NEON[i % NEON.length], cx = i * 128 + 64;
    x.strokeStyle = color; x.lineWidth = 5; x.shadowColor = color; x.shadowBlur = 12; x.strokeRect(i * 128 + 8, 8, 112, 496); x.shadowBlur = 0;
    const step = Math.min(84, 470 / w.length);
    [...w].forEach((ch, k) => glowText(ch, color, cx, 256 - (w.length - 1) * step / 2 + k * step, step * 0.85));
  });
  BOARDS.forEach((w, i) => {
    const ox = (i % 2) * 512, oy = 512 + ((i / 2) | 0) * 256, color = NEON[(i * 2 + 1) % NEON.length];
    x.fillStyle = ['#140a24', '#0a1a24', '#240a14', '#0a240f'][i]; x.fillRect(ox, oy, 512, 256);
    x.strokeStyle = color; x.lineWidth = 8; x.shadowColor = color; x.shadowBlur = 16; x.strokeRect(ox + 10, oy + 10, 492, 236); x.shadowBlur = 0;
    const words = w.split(' ');
    words.forEach((t, k) => glowText(t, k ? '#ffffff' : color, ox + 256, oy + 128 + (k - (words.length - 1) / 2) * 90, 80));
  });
  return texOf(c);
}

export class Shops {
  constructor(group, specs) {
    const rnd = mulberry32(4242);
    this.signTex = makeSignAtlas(rnd);
    this.neonTex = makeNeonAtlas();
    const body = new GB(), glass = new GB(), signs = new GB(), neon = new GB(), glow = new GB();
    this._glowShops = []; this._neonCount = 0; this._shopCount = 0;
    for (const s of specs) this._building(s, rnd, { body, glass, signs, neon, glow });

    const mk = (gb, mat) => {
      if (gb.empty) return null;
      const m = new THREE.Mesh(gb.build(), mat); m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false;
      group.add(m); return m;
    };
    this.bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    this.glassMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffffff });
    this.signMat = new THREE.MeshStandardMaterial({ map: this.signTex, emissiveMap: this.signTex, emissive: 0xffffff, emissiveIntensity: 0.2, roughness: 0.6 });
    this.neonMat = new THREE.MeshBasicMaterial({ map: this.neonTex, color: 0xffffff });
    this.glowMat = new THREE.MeshBasicMaterial({
      map: makeGlow(), vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    mk(body, this.bodyMat); mk(glass, this.glassMat); mk(signs, this.signMat); mk(neon, this.neonMat);
    this.glowMesh = mk(glow, this.glowMat);
    if (this.glowMesh) this.glowMesh.renderOrder = 4;
    this.update(0);
  }

  // night 0..1
  update(night) {
    this.glassMat.color.setScalar(0.16 + night * 0.34);
    this.signMat.emissiveIntensity = 0.2 + night * 0.95;
    this.neonMat.color.setScalar(0.65 + night * 0.95);
    this.glowMat.opacity = night * 0.9;
    if (this.glowMesh) this.glowMesh.visible = night > 0.02;
  }

  _building(s, rnd, G) {
    const { x0, z0, x1, z1, floors, tier, edges, wallCol } = s;
    // sides: [origin x, origin z, tangent x, tangent z, normal x, normal z, length]
    const sides = [
      [x0, z0, 1, 0, 0, -1, x1 - x0, edges.nz0], [x0, z1, 1, 0, 0, 1, x1 - x0, edges.nz1],
      [x0, z0, 0, 1, -1, 0, z1 - z0, edges.nx0], [x1, z0, 0, 1, 1, 0, z1 - z0, edges.nx1],
    ];
    const top = SLAB + floors * 3 + 0.4;
    let boardDone = false;
    for (const [ox, oz, tx, tz, nx, nz, len, street] of sides) {
      if (!street) continue;
      // viewer-right vector (nz, -nx); mirrored text if tangent points to the viewer's left
      const flip = tx * nz + tz * -nx < 0;
      const P = (u, y, d) => [ox + tx * u + nx * d, y, oz + tz * u + nz * d];
      const face = (u0, u1, y0, y1, d, col, uv) => {
        const ctr = P((u0 + u1) / 2, (y0 + y1) / 2, d - 1);
        const uvs = uv ? (flip ? [[uv[2], uv[1]], [uv[0], uv[1]], [uv[0], uv[3]], [uv[2], uv[3]]] : [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]])
          : [[0, 0], [1, 0], [1, 1], [0, 1]];
        return [P(u0, y0, d), P(u1, y0, d), P(u1, y1, d), P(u0, y1, d), uvs, col, ctr];
      };
      if (len >= 9) {
        const units = Math.min(3, Math.max(1, Math.floor((len - 1.6) / 8)));
        const W = (len - 1.6) / units;
        for (let k = 0; k < units; k++) this._shop(0.8 + k * W, W, SLAB, rnd, G, P, face, flip, nx, nz, tx, tz, wallCol);
      }
      // neon blade + roof board (downtown only)
      if (tier === 0 && rnd() < 0.55 && len > 12) {
        const i = (rnd() * BLADES.length) | 0, u = rnd() < 0.5 ? 1.2 : len - 1.2;
        const y0 = SLAB + 5 + rnd() * 5, h = 4.4, d0 = 0.15, d1 = 1.55;
        const u0 = i * 128 / 1024, u1 = (i * 128 + 128) / 1024, v0 = 0.5, v1 = 1.0;
        for (const side of [-1, 1]) { // two single-sided quads so text reads from both directions
          const ctr = P(u + side * -1, y0 + h / 2, (d0 + d1) / 2);
          const uvs = side * (nx * tz - nz * tx) > 0 ?[[u0, v0], [u1, v0], [u1, v1], [u0, v1]] : [[u1, v0], [u0, v0], [u0, v1], [u1, v1]];
          G.neon.quad(P(u, y0, d0), P(u, y0, d1), P(u, y0 + h, d1), P(u, y0 + h, d0), uvs, [1, 1, 1], ctr);
        }
        // bracket + glow
        this._box(G.body, P(u, y0 + h * 0.5, 0.08), 0.1, h * 0.9, 0.16, [0.12, 0.12, 0.14], nx, nz, tx, tz);
        const c = rgb(NEON[i % NEON.length]);
        G.glow.quad(P(u - 1.8, y0 - 0.8, d1 + 0.2), P(u + 1.8, y0 - 0.8, d1 + 0.2), P(u + 1.8, y0 + h + 0.8, d1 + 0.2), P(u - 1.8, y0 + h + 0.8, d1 + 0.2),
          [[0, 0], [1, 0], [1, 1], [0, 1]], c.map((v) => v * 0.55), P(u, y0 + h / 2, d1 - 3));
        this._neonCount++;
      }
      if (tier <= 1 && !boardDone && floors <= 14 && len > 16 && rnd() < 0.35) {
        boardDone = true;
        const i = (rnd() * BOARDS.length) | 0, ox2 = (i % 2) * 0.5, oy2 = 0.5 - ((i / 2) | 0) * 0.25;
        const u = len / 2, w = 9, h = 4.5, d = 0.9, y0 = top + 1.4;
        const uv = [ox2, oy2 - 0.25, ox2 + 0.5, oy2];
        const q = face(u - w / 2, u + w / 2, y0, y0 + h, d, [1, 1, 1], uv);
        G.neon.quad(...q);
        G.body.quad(...face(u - w / 2, u + w / 2, y0, y0 + h, d - 0.06, [0.1, 0.1, 0.12]).slice(0, 4), [[0, 0], [1, 0], [1, 1], [0, 1]], [0.1, 0.1, 0.12], P(u, y0 + h / 2, d + 1));
        for (const pu of [u - w / 3, u + w / 3]) this._box(G.body, P(pu, top + 0.7, d - 0.03), 0.2, 1.4, 0.2, [0.15, 0.15, 0.17], nx, nz, tx, tz);
        const c = rgb(NEON[(i * 2 + 1) % NEON.length]);
        G.glow.quad(P(u - w * 0.75, y0 - 1.5, d + 0.3), P(u + w * 0.75, y0 - 1.5, d + 0.3), P(u + w * 0.75, y0 + h + 1.5, d + 0.3), P(u - w * 0.75, y0 + h + 1.5, d + 0.3),
          [[0, 0], [1, 0], [1, 1], [0, 1]], c.map((v) => v * 0.5), P(u, y0 + h / 2, d - 3));
        this._neonCount++;
      }
    }
  }

  // small axis-aligned-in-face-frame box (size along tangent, y, normal)
  _box(gb, c, sw, sh, sd, col, nx, nz, tx, tz) {
    const hx = Math.abs(tx) * sw / 2 + Math.abs(nx) * sd / 2, hz = Math.abs(tz) * sw / 2 + Math.abs(nz) * sd / 2;
    gb.box(c[0] - hx, c[1] - sh / 2, c[2] - hz, c[0] + hx, c[1] + sh / 2, c[2] + hz, col, { mode: 'world' });
  }

  _shop(u0, W, y, rnd, G, P, face, flip, nx, nz, tx, tz, wallCol) {
    this._shopCount++;
    const open = rnd() < 0.85;
    const base = wallCol ? wallCol.map((v) => v * 0.38) : rgb(BASE_COLORS[(rnd() * BASE_COLORS.length) | 0]); // dark plinth derived from the wall colour
    const [awA, awB] = AWN[(rnd() * AWN.length) | 0];
    const u1 = u0 + W;
    // storefront band covers the facade's own ground-floor windows
    G.body.quad(...face(u0 + 0.05, u1 - 0.05, y, y + 3.35, 0.04, base));
    // window + door
    const mid = u0 + W / 2, dw = 0.7;
    const warm = [[1, 0.62, 0.18], [1, 0.45, 0.1], [0.12, 0.78, 0.8], [1, 0.78, 0.2]][(rnd() * 4) | 0];
    const gc = open ? warm : [0.06, 0.08, 0.1];
    const glassQuad = (a, b, y0, y1, d, col) => {
      const q = face(a, b, y0, y1, d, col);
      G.glass.quad(...q);
    };
    const dark = [0.05, 0.05, 0.06];
    // window = lit lower part, dimmer upper part, dark shelf stripes, and mullions (no extra meshes: glass + body)
    const window = (a, b) => {
      glassQuad(a, b, y + 0.5, y + 1.7, 0.08, gc);
      glassQuad(a, b, y + 1.7, y + 2.55, 0.08, gc.map((v) => v * 0.55));
      if (open) for (const sy of [0.95, 1.4, 1.85]) glassQuad(a, b, y + sy, y + sy + 0.09, 0.085, dark);
      const n = Math.max(1, Math.round((b - a) / 1.5));
      for (let k = 0; k <= n; k++) { const mu = a + (b - a) * k / n; G.body.quad(...face(mu - 0.05, mu + 0.05, y + 0.45, y + 2.6, 0.1, dark)); }
      G.body.quad(...face(a, b, y + 2.3, y + 2.4, 0.1, dark)); // transom
    };
    window(u0 + 0.4, mid - dw - 0.15);
    window(mid + dw + 0.15, u1 - 0.4);
    // door: frame + lit pane
    G.body.quad(...face(mid - dw - 0.08, mid + dw + 0.08, y, y + 2.5, 0.07, [0.08, 0.08, 0.09]));
    glassQuad(mid - dw, mid + dw, y + 0.1, y + 2.4, 0.09, open ? gc.map((v) => v * 0.8) : gc);
    // frame lines between the two windows and band edge (sill)
    G.body.quad(...face(u0 + 0.3, u1 - 0.3, y + 0.38, y + 0.5, 0.075, [0.1, 0.1, 0.11]));
    // awning: striped slope, lit from above, darker underside
    const stripes = Math.max(4, Math.round(W / 0.7)), sw = (W - 0.2) / stripes;
    for (let k = 0; k < stripes; k++) {
      const a = u0 + 0.1 + k * sw, b = a + sw, c = rgb(k % 2 ? awB : awA);
      G.body.quad(P(a, y + 3.3, 0.05), P(b, y + 3.3, 0.05), P(b, y + 2.65, 1.45), P(a, y + 2.65, 1.45), [[0, 0], [1, 0], [1, 1], [0, 1]], c, P((a + b) / 2, y + 1, 0.5));
      // no underside quad: it would face downward and render black when seen from below/inside
    }
    // front valance
    G.body.quad(P(u0 + 0.1, y + 2.4, 1.45), P(u1 - 0.1, y + 2.4, 1.45), P(u1 - 0.1, y + 2.67, 1.45), P(u0 + 0.1, y + 2.67, 1.45), [[0, 0], [1, 0], [1, 1], [0, 1]], rgb(awA), P(mid, y + 2.5, 0));
    // shop sign from the atlas
    const idx = (rnd() * 32) | 0, cu = (idx % 4) * 0.25, cv = 1 - ((idx / 4) | 0) / 8;
    const sw2 = Math.min(W - 0.6, 5.2), sh2 = sw2 / 4, sy = y + 3.5;
    G.signs.quad(...face(mid - sw2 / 2, mid + sw2 / 2, sy, sy + sh2, 0.1, [1, 1, 1], [cu, cv - 0.125, cu + 0.25, cv]));
    // light pool on the sidewalk
    if (open) {
      const c = warm.map((v) => v * 0.7);
      G.glow.quad(P(u0 - 0.5, y + 0.05, 0.2), P(u1 + 0.5, y + 0.05, 0.2), P(u1 + 0.5, y + 0.05, 4.2), P(u0 - 0.5, y + 0.05, 4.2), [[0, 0], [1, 0], [1, 1], [0, 1]], c, P(mid, y - 2, 2));
    }
  }
}
