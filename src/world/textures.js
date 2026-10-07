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

// Facade tile covers 24m x 12m: 8 columns x 4 floors of 3m cells (128px each).
export function makeFacade(style, rnd, aniso) {
  const W = 1024, H = 512, C = 128;
  const [mc, m] = cv(W, H), [ec, e] = cv(W, H);
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  const litP = style === 0 ? 0.42 : style === 1 ? 0.38 : 0.3;
  const wallCol = style === 0 ? '#c4cbd3' : style === 1 ? '#e2dccf' : '#d2d2cf';
  m.fillStyle = wallCol; m.fillRect(0, 0, W, H);
  speckle(m, W, H, rnd, 6000, 0.1);
  const warm = ['#ffe3a0', '#ffd68a', '#fff1c8', '#ffcf7a', '#cfe6ff'];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
    const x = c * C, y = r * C;
    let wx, wy, ww, wh;
    if (style === 0) { wx = x + 5; wy = y + 5; ww = C - 10; wh = C - 22; }
    else if (style === 1) { wx = x + 28; wy = y + 24; ww = C - 56; wh = C - 50; }
    else { wx = x + (c % 4 === 0 ? 14 : 4); wy = y + 36; ww = C - (c % 4 === 0 ? 18 : 8); wh = 56; }
    const lit = rnd() < litP;
    // glass
    const g = m.createLinearGradient(0, wy, 0, wy + wh);
    const k = 0.7 + rnd() * 0.5;
    if (style === 0) { g.addColorStop(0, `rgb(${70 * k | 0},${105 * k | 0},${140 * k | 0})`); g.addColorStop(1, `rgb(${28 * k | 0},${48 * k | 0},${72 * k | 0})`); }
    else { g.addColorStop(0, `rgb(${58 * k | 0},${74 * k | 0},${96 * k | 0})`); g.addColorStop(1, `rgb(${26 * k | 0},${34 * k | 0},${48 * k | 0})`); }
    if (style === 1) { m.fillStyle = '#f6f3ea'; m.fillRect(wx - 4, wy - 4, ww + 8, wh + 8); }
    m.fillStyle = g; m.fillRect(wx, wy, ww, wh);
    if (style === 0) { m.fillStyle = 'rgba(255,255,255,0.35)'; m.fillRect(wx + ww / 2 - 1, wy, 2, wh); }
    if (style === 1) { m.fillStyle = 'rgba(0,0,0,0.25)'; m.fillRect(wx - 6, wy + wh + 4, ww + 12, 6); m.fillRect(wx + ww / 2 - 1, wy, 2, wh); }
    if (style === 2) { m.fillStyle = 'rgba(0,0,0,0.18)'; m.fillRect(x, y + C - 12, C, 12); }
    if (style === 0) { m.fillStyle = 'rgba(40,46,56,0.55)'; m.fillRect(x, y + C - 14, C, 14); }
    if (lit) {
      e.fillStyle = warm[(rnd() * warm.length) | 0];
      e.globalAlpha = 0.65 + rnd() * 0.35;
      e.fillRect(wx, wy, ww, wh);
      e.globalAlpha = 1;
    }
  }
  const map = tex(mc, { aniso }), emissive = tex(ec, { aniso });
  return { map, emissive };
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
