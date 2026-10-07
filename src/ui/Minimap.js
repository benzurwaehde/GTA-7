import { CITY, ROAD_LINES, blockBounds } from '../core/config.js';

const SEA_MARGIN = 400;               // meters of sea drawn around the city
const PRE_SCALE = 1.2;                // px per meter of the pre-rendered static layer
const POI_STYLE = {
  hospital: { c: '#ff4d6d', t: '+' }, police: { c: '#3d7bff', t: 'P' }, garage: { c: '#ff9a2e', t: 'G' },
  shop: { c: '#38e07b', t: '$' }, safehouse: { c: '#d46bff', t: 'S' },
};

// Rotating (camera-up) circular minimap. Static layer (sea, blocks, roads) is rendered once to an offscreen canvas.
export class Minimap {
  constructor(game, size = 210) {
    this.game = game;
    this.size = size;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'vb-map';
    this.canvas.width = this.canvas.height = Math.round(size * dpr);
    this.canvas.style.width = this.canvas.style.height = size + 'px';
    this.ctx = this.canvas.getContext('2d');
    this.dpr = dpr;
    this.range = 150;                 // meters from center to edge
    this.static = this.buildStatic();
  }

  buildStatic() {
    const W = CITY.size + SEA_MARGIN * 2, px = Math.ceil(W * PRE_SCALE);
    const c = document.createElement('canvas'); c.width = c.height = px;
    const g = c.getContext('2d');
    g.scale(PRE_SCALE, PRE_SCALE); g.translate(W / 2, W / 2);
    const sea = g.createRadialGradient(0, 0, CITY.half, 0, 0, W / 2);
    sea.addColorStop(0, '#0d3a63'); sea.addColorStop(1, '#06182f');
    g.fillStyle = sea; g.fillRect(-W / 2, -W / 2, W, W);
    // land
    g.fillStyle = '#1b1538'; g.fillRect(-CITY.half, -CITY.half, CITY.size, CITY.size);
    // blocks
    g.fillStyle = '#2a2150';
    for (let i = 0; i < CITY.blocks; i++) for (let j = 0; j < CITY.blocks; j++) {
      const b = blockBounds(i, j); g.fillRect(b.minX, b.minZ, b.maxX - b.minX, b.maxZ - b.minZ);
    }
    // roads
    g.fillStyle = '#6a63a8';
    for (const r of ROAD_LINES) {
      g.fillRect(r - CITY.roadWidth / 2, -CITY.half, CITY.roadWidth, CITY.size);
      g.fillRect(-CITY.half, r - CITY.roadWidth / 2, CITY.size, CITY.roadWidth);
    }
    // coast glow
    g.strokeStyle = 'rgba(25,227,255,.55)'; g.lineWidth = 3;
    g.strokeRect(-CITY.half, -CITY.half, CITY.size, CITY.size);
    this.W = W;
    return c;
  }

  draw(time) {
    const game = this.game, ctx = this.ctx, S = this.size, R = S / 2, d = this.dpr;
    const p = game.player?.position;
    const px = p ? p.x : 0, pz = p ? p.z : 0;
    // camera forward on the ground plane = "up" on the map
    let fx = 0, fz = -1;
    if (game.camera) {
      const v = game.camera.getWorldDirection(this._v || (this._v = game.camera.position.clone()));
      const l = Math.hypot(v.x, v.z); if (l > 0.001) { fx = v.x / l; fz = v.z / l; }
    }
    const s = R / this.range;
    // world -> screen (css px)
    const sx = (x, z) => R + (-fz * (x - px) + fx * (z - pz)) * s;
    const sy = (x, z) => R + (-fx * (x - px) - fz * (z - pz)) * s;

    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R - 1, 0, Math.PI * 2); ctx.clip();
    // static layer
    ctx.save();
    ctx.setTransform(d * -fz * s, d * -fx * s, d * fx * s, d * -fz * s, d * R, d * R);
    ctx.translate(-px, -pz);
    ctx.drawImage(this.static, -this.W / 2, -this.W / 2, this.W, this.W);
    ctx.restore();

    const inside = (x, z, pad = 0) => Math.hypot(x - px, z - pz) * s < R - pad;
    // POIs
    const pois = game.world?.pois;
    if (pois) for (const o of pois) {
      if (!inside(o.x, o.z, 6)) continue;
      const st = POI_STYLE[o.type] || POI_STYLE.shop;
      this.icon(ctx, sx(o.x, o.z), sy(o.x, o.z), st.c, st.t, 7);
    }
    // vehicles
    const list = game.vehicles?.list;
    if (list) {
      const flash = Math.floor(time * 5) % 2 === 0;
      for (const v of list) {
        if (v.destroyed || v === game.player?.vehicle || !inside(v.position.x, v.position.z, 3)) continue;
        const x = sx(v.position.x, v.position.z), y = sy(v.position.x, v.position.z);
        if (v.isPolice) { ctx.fillStyle = flash ? '#ff2d4a' : '#2d6bff'; ctx.fillRect(x - 3.5, y - 3.5, 7, 7); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(x - 3.5, y - 3.5, 7, 7); }
        else { ctx.fillStyle = 'rgba(210,205,240,.75)'; ctx.fillRect(x - 2, y - 2, 4, 4); }
      }
    }
    ctx.restore();

    // mission blips + objective (clamped to the rim so they always guide you)
    const blips = game.missions?.getBlips?.();
    if (blips) for (const b of blips) this.rimBlip(ctx, b.x, b.z, sx, sy, R, b.color || '#ff2d95', b.letter || 'M', false, time, px, pz, s);
    const ob = game.missions?.getObjectiveMarker?.();
    if (ob) this.rimBlip(ctx, ob.x, ob.z, sx, sy, R, '#ffd24a', '!', true, time, px, pz, s);

    // player arrow (heading relative to camera)
    const h = game.player?.heading ?? 0;
    const hx = Math.sin(h), hz = Math.cos(h);
    const ux = -fz * hx + fx * hz;
    ctx.save();
    ctx.translate(R, R); ctx.rotate(Math.atan2(ux, fx * hx + fz * hz));
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6.5, 7); ctx.lineTo(0, 3.5); ctx.lineTo(-6.5, 7); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#ff2d95'; ctx.stroke();
    ctx.restore();

    // north marker on the rim (north = world -z)
    const nax = R - fx * (R - 12), nay = R + fz * (R - 12);
    ctx.font = 'bold 13px Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff2d95'; ctx.fillText('N', nax, nay);
  }

  icon(ctx, x, y, color, text, r) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#0b0618'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
  }

  rimBlip(ctx, wx, wz, sx, sy, R, color, text, pulse, time, px, pz, s) {
    let x = sx(wx, wz), y = sy(wx, wz);
    const dx = x - R, dy = y - R, dist = Math.hypot(dx, dy), lim = R - 10;
    if (dist > lim) { x = R + dx / dist * lim; y = R + dy / dist * lim; }
    const r = 8 + (pulse ? Math.sin(time * 6) * 1.5 : 0);
    this.icon(ctx, x, y, color, text, r);
  }
}
