import * as THREE from 'three';

function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, { srgb = true, repeat = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}
function speckle(ctx, w, h, rnd, n, a = 0.08) {
  for (let i = 0; i < n; i++) {
    const v = rnd() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${rnd() * a})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

// Facade tile covers 24m x 12m: 4 floors of 3m (128px each). Columns per style: 8 (0-2), 4 wide ribbon bays (3), 12 narrow (4).
// Styles: 0 glass tower, 1 stucco house/mid-rise, 2 plain block, 3 industrial ribbon windows, 4 apartment block with ledges.
export const FACADE_STYLES = 5;
const COLS = [8, 8, 8, 4, 12];
const WARM = [[255, 214, 140], [255, 200, 120], [255, 240, 210], [255, 225, 170]];
const COOL = [[150, 190, 255], [190, 215, 255]];
const PINK = [[255, 150, 200], [255, 170, 120]];

// One lit window: random hue and brightness, a vertical gradient (lamp near the ceiling) and sometimes a curtain,
// so the night facade is a mix of bright, dim and dark windows instead of a flat white block.
function litWindow(e, rnd, x, y, w, h) {
  const r = rnd();
  const pal = r < 0.7 ? WARM : r < 0.88 ? COOL : PINK;
  const c = pal[(rnd() * pal.length) | 0];
  const k = 0.2 + 0.8 * Math.pow(rnd(), 1.7);
  const g = e.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, `rgb(${c[0] * k | 0},${c[1] * k | 0},${c[2] * k | 0})`);
  g.addColorStop(1, `rgb(${c[0] * k * 0.55 | 0},${c[1] * k * 0.5 | 0},${c[2] * k * 0.5 | 0})`);
  e.fillStyle = g; e.fillRect(x, y, w, h);
  if (rnd() < 0.3) { // curtain / blind
    e.fillStyle = 'rgba(0,0,0,0.55)';
    const cw = w * (0.25 + rnd() * 0.4);
    if (rnd() < 0.5) e.fillRect(x, y, cw, h); else e.fillRect(x + w - cw, y, cw, h);
  } else if (rnd() < 0.18) { e.fillStyle = 'rgba(0,0,0,0.45)'; e.fillRect(x, y, w, h * (0.3 + rnd() * 0.4)); }
}

export function makeFacade(style, rnd, aniso) {
  const W = 1024, H = 512, C = 128, cols = COLS[style], CW = W / cols;
  const [mc, m] = cv(W, H), [ec, e] = cv(W, H);
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  const litP = [0.42, 0.38, 0.3, 0.24, 0.45][style];
  const wallCol = ['#c4cbd3', '#e2dccf', '#d2d2cf', '#bdb8ae', '#dbc9b4'][style];
  m.fillStyle = wallCol; m.fillRect(0, 0, W, H);
  speckle(m, W, H, rnd, 6000, 0.1);
  if (style === 3) { // concrete panel joints
    m.fillStyle = 'rgba(0,0,0,0.12)';
    for (let c = 0; c < cols; c++) m.fillRect(c * CW, 0, 2, H);
    for (let r = 0; r < 4; r++) m.fillRect(0, r * C + 6, W, 2);
  }
  for (let r = 0; r < 4; r++) {
    const floorBias = 0.35 + 0.9 * rnd(); // some floors are mostly dark at night
    for (let c = 0; c < cols; c++) {
      const x = c * CW, y = r * C;
      let wx, wy, ww, wh;
      if (style === 0) { wx = x + 5; wy = y + 5; ww = CW - 10; wh = C - 22; }
      else if (style === 1) { wx = x + 28; wy = y + 24; ww = CW - 56; wh = C - 50; }
      else if (style === 2) { wx = x + (c % 4 === 0 ? 14 : 4); wy = y + 36; ww = CW - (c % 4 === 0 ? 18 : 8); wh = 56; }
      else if (style === 3) { wx = x + 14; wy = y + 40; ww = CW - 28; wh = 48; }
      else { wx = x + 14; wy = y + 28; ww = CW - 28; wh = 66; }
      const lit = rnd() < litP * floorBias;
      const g = m.createLinearGradient(0, wy, 0, wy + wh);
      const k = 0.7 + rnd() * 0.5;
      if (style === 0) { g.addColorStop(0, `rgb(${70 * k | 0},${105 * k | 0},${140 * k | 0})`); g.addColorStop(1, `rgb(${28 * k | 0},${48 * k | 0},${72 * k | 0})`); }
      else if (style === 3) { g.addColorStop(0, `rgb(${96 * k | 0},${118 * k | 0},${120 * k | 0})`); g.addColorStop(1, `rgb(${40 * k | 0},${54 * k | 0},${58 * k | 0})`); }
      else { g.addColorStop(0, `rgb(${58 * k | 0},${74 * k | 0},${96 * k | 0})`); g.addColorStop(1, `rgb(${26 * k | 0},${34 * k | 0},${48 * k | 0})`); }
      if (style === 1) { m.fillStyle = '#f6f3ea'; m.fillRect(wx - 4, wy - 4, ww + 8, wh + 8); }
      if (style === 4) { m.fillStyle = '#f2ede2'; m.fillRect(wx - 3, wy - 3, ww + 6, wh + 6); }
      m.fillStyle = g; m.fillRect(wx, wy, ww, wh);
      if (style === 0) { m.fillStyle = 'rgba(255,255,255,0.35)'; m.fillRect(wx + ww / 2 - 1, wy, 2, wh); }
      if (style === 1) { m.fillStyle = 'rgba(0,0,0,0.25)'; m.fillRect(wx - 6, wy + wh + 4, ww + 12, 6); m.fillRect(wx + ww / 2 - 1, wy, 2, wh); }
      if (style === 2) { m.fillStyle = 'rgba(0,0,0,0.18)'; m.fillRect(x, y + C - 12, C, 12); }
      if (style === 0) { m.fillStyle = 'rgba(40,46,56,0.55)'; m.fillRect(x, y + C - 14, C, 14); }
      if (style === 3) { // mullions of the ribbon window
        m.fillStyle = 'rgba(30,34,36,0.7)';
        for (let q = 1; q < 4; q++) m.fillRect(wx + (ww * q) / 4 - 1, wy, 3, wh);
      }
      if (style === 4) { // balcony ledge under every window + sill shadow
        m.fillStyle = 'rgba(70,64,58,0.55)'; m.fillRect(x - 2, y + C - 20, CW + 4, 8);
        m.fillStyle = 'rgba(0,0,0,0.2)'; m.fillRect(wx, wy + wh + 3, ww, 4);
      }
      if (lit) {
        if (style === 3) { // ribbon windows light up in bays
          const bays = 4, bw = ww / bays;
          for (let q = 0; q < bays; q++) if (rnd() < 0.7) litWindow(e, rnd, wx + q * bw + 1, wy, bw - 3, wh);
        } else litWindow(e, rnd, wx, wy, ww, wh);
      }
    }
  }
  const map = tex(mc, { aniso }), emissive = tex(ec, { aniso });
  return { map, emissive };
}

// Wood planks for the pier and the boardwalk: lines run across the u direction (planks laid across the walkway).
export function makeWood(rnd, aniso) {
  const S = 256, [c, x] = cv(S, S);
  const rows = 8, rh = S / rows;
  for (let r = 0; r < rows; r++) {
    const v = 0.78 + rnd() * 0.3;
    x.fillStyle = `rgb(${150 * v | 0},${108 * v | 0},${68 * v | 0})`; x.fillRect(0, r * rh, S, rh);
    x.fillStyle = 'rgba(40,24,10,0.55)'; x.fillRect(0, r * rh, S, 2);
    for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(60,38,18,${0.08 + rnd() * 0.12})`; x.fillRect(rnd() * S, r * rh + 3 + rnd() * (rh - 6), 20 + rnd() * 90, 1); }
    x.fillStyle = 'rgba(30,20,10,0.5)'; x.fillRect(((r * 97) % S), r * rh + 3, 3, 3); x.fillRect(((r * 97 + 120) % S), r * rh + 3, 3, 3);
  }
  return tex(c, { aniso });
}

// Corrugated container wall (grey ribs, painted per instance colour).
export function makeContainer(aniso) {
  const W = 128, H = 64, [c, x] = cv(W, H);
  x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < W; i += 4) { x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(i, 4, 1, H - 8); x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(i + 2, 4, 1, H - 8); }
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, 0, W, 4); x.fillRect(0, H - 4, W, 4);
  x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, 0, 4, H); x.fillRect(W - 4, 0, 4, H);
  return tex(c, { repeat: false, aniso });
}

export function makeRoad(rnd, aniso) {
  const S = 256, [c, x] = cv(S, S);
  x.fillStyle = '#3c3e43'; x.fillRect(0, 0, S, S);
  speckle(x, S, S, rnd, 9000, 0.12);
  // wheel tracks
  for (const px of [S * 0.25, S * 0.75]) {
    const g = x.createLinearGradient(px - 22, 0, px + 22, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(px - 22, 0, 44, S);
  }
  x.fillStyle = '#e8b923'; x.fillRect(S / 2 - 6, 0, 3, S); x.fillRect(S / 2 + 3, 0, 3, S);
  x.fillStyle = 'rgba(235,235,235,0.9)'; x.fillRect(6, 0, 3, S); x.fillRect(S - 9, 0, 3, S);
  return tex(c, { aniso });
}

export function makeAsphalt(rnd, aniso) {
  const S = 128, [c, x] = cv(S, S);
  x.fillStyle = '#3f4146'; x.fillRect(0, 0, S, S);
  speckle(x, S, S, rnd, 3500, 0.14);
  return tex(c, { aniso });
}

export function makeSidewalk(rnd, aniso) {
  const S = 256, [c, x] = cv(S, S);
  x.fillStyle = '#b9b7b0'; x.fillRect(0, 0, S, S);
  speckle(x, S, S, rnd, 5000, 0.1);
  x.fillStyle = 'rgba(60,60,55,0.55)';
  x.fillRect(0, 0, S, 2); x.fillRect(0, 0, 2, S); x.fillRect(0, S / 2, S, 2); x.fillRect(S / 2, 0, 2, S);
  return tex(c, { aniso });
}

export function makeTerrain(rnd, aniso) {
  const S = 256, [c, x] = cv(S, S);
  x.fillStyle = '#e6e6e6'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {
    const v = 190 + rnd() * 65 | 0;
    x.fillStyle = `rgba(${v},${v},${v},0.35)`;
    x.beginPath(); x.arc(rnd() * S, rnd() * S, 3 + rnd() * 16, 0, 6.3); x.fill();
  }
  speckle(x, S, S, rnd, 4000, 0.25);
  return tex(c, { aniso });
}

export function makeWaterNormal(rnd, aniso) {
  const S = 256, [c, x] = cv(S, S);
  const img = x.createImageData(S, S);
  const h = new Float32Array(S * S);
  const waves = Array.from({ length: 9 }, () => ({ fx: ((rnd() * 5) | 0) + 1, fy: ((rnd() * 5) | 0) + 1, p: rnd() * 6.28, a: 0.4 + rnd() }));
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    let v = 0;
    for (const w of waves) v += Math.sin((i / S * w.fx + j / S * w.fy) * 6.2832 + w.p) * w.a;
    h[j * S + i] = v;
  }
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = h[j * S + ((i + 1) % S)] - h[j * S + ((i + S - 1) % S)];
    const dy = h[((j + 1) % S) * S + i] - h[((j + S - 1) % S) * S + i];
    const nx = -dx * 0.5, ny = -dy * 0.5, nz = 1, l = Math.hypot(nx, ny, nz);
    const o = (j * S + i) * 4;
    img.data[o] = (nx / l * 0.5 + 0.5) * 255; img.data[o + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[o + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return tex(c, { srgb: false, aniso });
}

export function makeGlow() {
  const [c, x] = cv(128, 128);
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return tex(c, { repeat: false });
}

export function makeSign(text, bg, fg, icon) {
  const [c, x] = cv(512, 128);
  x.fillStyle = bg; x.fillRect(0, 0, 512, 128);
  x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(6, 6, 500, 116);
  x.fillStyle = fg; x.font = 'bold 64px Arial, Helvetica, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const off = icon ? 40 : 0;
  x.fillText(text, 256 + off, 68);
  if (icon === 'cross') { x.fillStyle = '#e03030'; x.fillRect(26, 44, 60, 20 + 0); x.fillRect(46, 24, 20, 62 + 0); }
  if (icon === 'star') { x.fillStyle = fg; x.font = 'bold 64px Arial'; x.fillText('★', 56, 68); }
  return tex(c, { repeat: false, aniso: 8 });
}
