import { WEAPON_DEFS } from '../player/Weapons.js';

// Weapon wheel: hold Tab to open a radial menu in slow motion (game.timeScale = 0.25), move the mouse towards a weapon,
// release Tab to equip it. Weapons the player does not own are greyed out. Registered as game.weaponWheel.
const SLOW = 0.25, SIZE = 640, C = SIZE / 2, R_IN = 108, R_OUT = 262, DEAD = 34, STICK = 150;

// Side-view silhouettes (viewBox 100 x 50, muzzle to the right) as SVG path data, drawn with Path2D.
const ICONS = {
  fists: 'M26 18 h30 a7 7 0 0 1 7 7 v10 a7 7 0 0 1 -7 7 h-22 a12 12 0 0 1 -12 -12z M63 20 h8 a4 4 0 0 1 0 8 h-8z M63 29 h7 a3.5 3.5 0 0 1 0 7 h-7z M20 22 h6 v14 h-6z',
  pistol: 'M18 12 h60 v11 h-26 v6 l-3 3 h-7 l-7 15 h-12 l7 -16 v-8 h-12z',
  smg: 'M4 18 h12 v5 h6 v-5 h46 v8 h-4 v3 h-10 l-3 -3 h-6 l-3 3 h-4 v18 h-9 v-18 h-6 l-6 12 h-8 l6 -13 h-10 v-6 h-3z M68 20 h28 v4 h-28z',
  shotgun: 'M2 22 l22 -6 h22 v-1 h50 v4 h-48 v3 h38 v3 h-38 v3 h-24 l-4 9 h-8 l3 -9 h-6 l-12 -3z M54 30 h16 v5 h-16z',
  rifle: 'M2 17 h16 l4 -2 h38 v4 h12 v-2 h24 v4 h-22 v6 h-10 v4 h-6 l-4 -4 h-8 l-3 18 h-8 l2 -18 h-6 l-6 4 h-8 l5 -10 h-14z',
  sniper: 'M2 20 l20 -4 h14 v-6 h24 v6 h36 v5 h-36 v3 h-44 l-5 8 h-8 l4 -8 h-6 l-8 -2z M32 11 h-6 v3 h6z',
  grenade: 'M50 12 a16 17 0 1 0 0.1 0z M45 6 h12 v7 h-12z M58 8 h14 a3 3 0 0 1 0 6 h-14z',
};
const PATHS = {};
for (const k in ICONS) { try { PATHS[k] = new Path2D(ICONS[k]); } catch (e) { PATHS[k] = null; } }

export class WeaponWheel {
  constructor(game) {
    this.game = game;
    this.open = false;
    this.hover = -1;              // hovered weapon index (into WEAPON_DEFS), -1 = none
    this.stick = { x: 0, y: 0 };  // virtual cursor relative to the centre (px)
    this.prevScale = 1;
    const root = this.root = document.createElement('div');
    root.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:30;pointer-events:none;background:radial-gradient(circle at 50% 50%,rgba(10,6,24,.15),rgba(10,6,24,.72))';
    const cv = this.canvas = document.createElement('canvas');
    cv.width = cv.height = SIZE; cv.style.cssText = 'width:min(86vh,640px);height:min(86vh,640px)';
    root.appendChild(cv); game.ui.appendChild(root);
    this.ctx = cv.getContext('2d');
    addEventListener('mousemove', e => this.onMove(e));
    // update() does not run while the game is paused, so close on the events that lead to a pause
    const abort = () => this.show(false);
    addEventListener('keydown', e => { if (e.code === 'Escape') abort(); });
    document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) abort(); });
    addEventListener('blur', abort);
  }

  onMove(e) {
    if (!this.open) return;
    const m = this.game.input.mouse;
    if (m.locked) { // pointer lock: integrate the relative movement into a virtual stick
      const s = this.stick; s.x += e.movementX; s.y += e.movementY;
      const l = Math.hypot(s.x, s.y); if (l > STICK) { s.x *= STICK / l; s.y *= STICK / l; }
    } else { // free cursor: position relative to the screen centre, scaled to the stick range
      const s = this.stick, sc = STICK / (Math.min(innerWidth, innerHeight) * 0.3);
      s.x = (e.clientX - innerWidth / 2) * sc; s.y = (e.clientY - innerHeight / 2) * sc;
      const l = Math.hypot(s.x, s.y); if (l > STICK) { s.x *= STICK / l; s.y *= STICK / l; }
    }
  }

  // Sector index for an angle (0 = top, clockwise), or -1 inside the dead zone.
  sectorAt(x, y) {
    if (Math.hypot(x, y) < DEAD) return -1;
    const n = WEAPON_DEFS.length;
    let a = Math.atan2(x, -y); if (a < 0) a += Math.PI * 2;
    return Math.floor(((a + Math.PI / n) % (Math.PI * 2)) / (Math.PI * 2 / n));
  }

  show(on) {
    const g = this.game;
    if (on === this.open) return;
    this.open = on;
    this.root.style.display = on ? 'flex' : 'none';
    if (on) {
      this.prevScale = g.timeScale === SLOW ? 1 : g.timeScale;
      g.timeScale = SLOW;
      this.stick.x = this.stick.y = 0;
      this.hover = -1;
      this.sel = g.player?.weapons?.index ?? 0;
    } else if (g.timeScale === SLOW) g.timeScale = this.prevScale;
  }

  // Equip the hovered weapon (if owned) and close.
  commit() {
    const w = this.game.player?.weapons;
    if (w && this.hover >= 0 && this.hover !== w.index && w.states[this.hover]?.owned) w.select(this.hover);
  }

  update() {
    const g = this.game, inp = g.input, p = g.player;
    const can = !!p && p.alive !== false && !p.vehicle && !g.shop?.isOpen && !g.paused && performance.now() - (g.shop?.closedAt ?? -1e9) > 300;
    const down = inp.isDown('Tab');
    if (!this.open) {
      if (down && can && inp.pressed('Tab')) this.show(true);
      else return;
    } else if (!down || !can) { if (can) this.commit(); this.show(false); return; }
    const h = this.sectorAt(this.stick.x, this.stick.y);
    if (h !== this.hover) { this.hover = h; if (h >= 0) g.audio?.play?.('tick'); }
    this.draw();
  }

  draw() {
    const ctx = this.ctx, defs = WEAPON_DEFS, n = defs.length, w = this.game.player?.weapons;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const slice = Math.PI * 2 / n;
    for (let i = 0; i < n; i++) {
      const st = w?.states[i], owned = !!st?.owned, hov = i === this.hover, cur = i === w?.index;
      const a0 = -Math.PI / 2 + i * slice - slice / 2 + 0.012, a1 = a0 + slice - 0.024;
      ctx.beginPath(); ctx.arc(C, C, R_OUT, a0, a1); ctx.arc(C, C, R_IN, a1, a0, true); ctx.closePath();
      ctx.fillStyle = hov ? (owned ? 'rgba(255,45,149,.85)' : 'rgba(120,60,90,.6)') : cur ? 'rgba(60,30,110,.9)' : owned ? 'rgba(24,14,48,.85)' : 'rgba(18,14,28,.7)';
      ctx.fill();
      ctx.lineWidth = hov ? 4 : 2; ctx.strokeStyle = hov && owned ? '#fff' : owned ? 'rgba(255,45,149,.65)' : 'rgba(110,100,130,.45)'; ctx.stroke();
      // icon
      const am = -Math.PI / 2 + i * slice, rm = (R_IN + R_OUT) / 2;
      const cx = C + Math.cos(am) * rm, cy = C + Math.sin(am) * rm - 8;
      const path = PATHS[defs[i].id];
      if (path) {
        ctx.save(); ctx.translate(cx - 50 * 0.6, cy - 25 * 0.6 - 6); ctx.scale(1.2, 1.2);
        ctx.fillStyle = owned ? (hov ? '#fff' : '#f4eaff') : 'rgba(150,140,170,.35)'; ctx.fill(path); ctx.restore();
      }
      // ammo (clip / reserve) under the icon
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 20px Impact, "Arial Narrow", sans-serif';
      ctx.fillStyle = owned ? '#ffd24a' : 'rgba(150,140,170,.5)';
      let t = owned ? '' : 'LOCKED';
      if (owned && !defs[i].melee) t = `${st.clip} / ${st.ammo}`;
      ctx.fillText(t, cx, cy + 46);
      ctx.font = 'bold 15px Arial, sans-serif'; ctx.fillStyle = owned ? 'rgba(255,255,255,.85)' : 'rgba(150,140,170,.45)';
      ctx.fillText(defs[i].name.toUpperCase(), cx, cy + 66);
    }
    // centre: hovered / current weapon
    const idx = this.hover >= 0 ? this.hover : (w?.index ?? 0), d = defs[idx], st = w?.states[idx];
    ctx.beginPath(); ctx.arc(C, C, R_IN - 14, 0, Math.PI * 2); ctx.fillStyle = 'rgba(10,6,24,.82)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,45,149,.8)'; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.font = 'bold 30px Impact, "Arial Narrow", sans-serif'; ctx.fillText(d.name.toUpperCase(), C, C - 16);
    ctx.font = 'bold 22px Arial, sans-serif'; ctx.fillStyle = st?.owned ? '#ffd24a' : '#9a8fb5';
    ctx.fillText(!st?.owned ? 'not owned' : d.melee ? 'melee' : `${st.clip} / ${st.ammo}`, C, C + 20);
    // cursor dot
    ctx.beginPath(); ctx.arc(C + this.stick.x * 0.8, C + this.stick.y * 0.8, 6, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  }
}
