import * as THREE from 'three';
import { CITY, blockBounds } from '../core/config.js';
import { WEAPON_DEFS } from '../player/Weapons.js';
import { SHOP_NAME, WEAPONS, AMMO, ARMOR } from './catalog.js';
import { buildStorefront } from './Storefront.js';
import { ShopMenu } from './ShopMenu.js';

const KEY = 'gta7.arms', SLOW = 0.02, RADIUS = 2.3, SIDEWALK_IN = 3.3;
const ROT = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };
const nameOf = id => WEAPON_DEFS.find(d => d.id === id)?.name ?? id;

// Weapon shop "Bullseye Arms": a free-standing shop building on a block edge, entrance marker, minimap blip and a buy menu.
// Ownership + ammo are stored under their own localStorage key (gta7.arms), Save.js stays untouched.
export class Shop {
  constructor(game) {
    this.game = game;
    this.name = SHOP_NAME;
    this.menu = new ShopMenu(game);
    this.position = new THREE.Vector3();     // entrance marker (world)
    this.placed = false;
    this.armed = true;                        // the marker re-arms after the player stepped away
    this.restored = false; this.disabled = false; this.closedAt = -1e9; this.t = 0; this.saveT = 0; this.prevScale = 1;
    this.place();
    addEventListener('keydown', e => this.onKey(e), true);
    addEventListener('beforeunload', () => this.persist());
    // New Game wipes the shop data as well (wrap Save.newGame, Save.js itself is not touched)
    const sv = game.save;
    if (sv?.newGame && !sv._shopWrapped) {
      const ng = sv.newGame.bind(sv); sv._shopWrapped = true;
      sv.newGame = () => { this.disabled = true; try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } ng(); }; // disabled: beforeunload must not write the key again
    }
  }

  get isOpen() { return this.menu.isOpen; }

  // ---------- placement ----------
  // Find a free strip on a block edge near the start (not in front of a building door), nearest first; prefer one next to a building.
  place() {
    const g = this.game, world = g.world;
    if (!world?.colliders) return;
    const cols = world.colliders.filter(b => !b.invisible);
    const sp = world.getSpawnPoint?.() || { x: 0, z: 0 };
    const sf = this.sf = buildStorefront();
    const { W, D } = sf;
    const free = (x0, z0, x1, z1, m) => !cols.some(b => b.minX < x1 + m && b.maxX > x0 - m && b.minZ < z1 + m && b.maxZ > z0 - m);
    const cand = [];
    for (let i = 0; i < CITY.blocks; i++) for (let j = 0; j < CITY.blocks; j++) {
      const b = blockBounds(i, j);
      for (const side of ['n', 's', 'e', 'w']) for (let t = 14; t <= 46; t += 3) {
        let x0, z0, x1, z1, fx, fz;
        if (side === 'n') { x0 = b.minX + t - W / 2; x1 = x0 + W; z0 = b.minZ + SIDEWALK_IN; z1 = z0 + D; fx = (x0 + x1) / 2; fz = z0; }
        else if (side === 's') { x0 = b.minX + t - W / 2; x1 = x0 + W; z1 = b.maxZ - SIDEWALK_IN; z0 = z1 - D; fx = (x0 + x1) / 2; fz = z1; }
        else if (side === 'w') { z0 = b.minZ + t - W / 2; z1 = z0 + W; x0 = b.minX + SIDEWALK_IN; x1 = x0 + D; fx = x0; fz = (z0 + z1) / 2; }
        else { z0 = b.minZ + t - W / 2; z1 = z0 + W; x1 = b.maxX - SIDEWALK_IN; x0 = x1 - D; fx = x1; fz = (z0 + z1) / 2; }
        const d = Math.hypot(fx - sp.x, fz - sp.z);
        if (d < 22 || !free(x0, z0, x1, z1, 1.5)) continue;
        // a neighbouring building within 3 m left or right makes it look like a row of shops
        const wide = side === 'n' || side === 's' ? [x0 - 3, z0, x1 + 3, z1] : [x0, z0 - 3, x1, z1 + 3];
        const row = !free(wide[0], wide[1], wide[2], wide[3], 0) ? 0 : 1;
        cand.push({ side, box: [x0, z0, x1, z1], fx, fz, score: d + row * 60 });
      }
    }
    cand.sort((a, c) => a.score - c.score);
    const c = cand[0];
    if (!c) { console.warn('[shop] no free storefront found'); return; }
    sf.root.position.set(c.fx, 0, c.fz); sf.root.rotation.y = ROT[c.side];
    g.scene.add(sf.root);
    sf.root.updateMatrixWorld(true);
    sf.markerLocal.applyMatrix4(sf.root.matrixWorld);
    this.position.copy(sf.markerLocal);
    const [x0, z0, x1, z1] = c.box;
    world.colliders.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, maxY: sf.H + 0.6, type: 'building', poi: 'weapons' });
    world.pois?.push({ type: 'weapons', name: SHOP_NAME, x: this.position.x, z: this.position.z });
    this.placed = true;
  }

  // Minimap blips (same shape as game.missions.getBlips()).
  getBlips() { return this.placed ? [{ x: this.position.x, z: this.position.z, color: '#ff2d4a', letter: '$', name: SHOP_NAME }] : []; }

  // ---------- menu ----------
  open() {
    const g = this.game;
    if (this.isOpen || !this.placed) return;
    this.prevScale = g.timeScale === SLOW ? 1 : g.timeScale;
    g.timeScale = SLOW;
    this.menu.open(() => this.rows());
    g.audio?.play?.('pickup');
  }
  close() {
    const g = this.game;
    if (!this.isOpen) return;
    this.menu.close(); this.closedAt = performance.now();
    if (g.timeScale === SLOW) g.timeScale = this.prevScale;
    this.persist();
  }

  onKey(e) {
    if (!this.isOpen) return;
    const c = e.code;
    if (c === 'ArrowUp' || c === 'KeyW') this.menu.move(-1);
    else if (c === 'ArrowDown' || c === 'KeyS') this.menu.move(1);
    else if (c === 'Enter' || c === 'Space' || c === 'KeyE') this.menu.buy();
    else if (c === 'KeyF' || c === 'Escape' || c === 'Backspace' || c === 'Tab') this.close();
    else return;
    if (c !== 'Escape') { e.preventDefault(); e.stopPropagation(); }
  }

  // Menu rows from the current state. state: 'ok' (buyable), 'poor' (not enough money), 'off' (owned / full / locked).
  rows() {
    const g = this.game, w = g.player?.weapons, money = g.state.money | 0, rows = [];
    const price = p => '$' + p.toLocaleString('en-US');
    for (const it of WEAPONS) {
      const st = w?.stateOf(it.id), d = WEAPON_DEFS.find(x => x.id === it.id);
      const owned = !!st?.owned;
      const again = owned && it.pack;
      let state = 'ok', label = price(it.price), name = nameOf(it.id);
      if (owned && !it.pack) { state = 'off'; label = 'OWNED'; }
      else if (again && st.ammo >= (d.maxReserve ?? 99)) { state = 'off'; label = 'FULL'; }
      else if (money < it.price) state = 'poor';
      if (again) name += ` (have ${st.clip + st.ammo})`;
      rows.push({ section: 'WEAPONS', name, sub: it.blurb, label, state, run: () => this.buyWeapon(it) });
    }
    for (const it of AMMO) {
      const st = w?.stateOf(it.id), d = WEAPON_DEFS.find(x => x.id === it.id);
      const owned = !!st?.owned;
      let state = 'ok', label = price(it.price);
      if (!owned) { state = 'off'; label = 'LOCKED'; }
      else if (st.ammo >= (d.maxReserve ?? 9999)) { state = 'off'; label = 'FULL'; }
      else if (money < it.price) state = 'poor';
      rows.push({ section: 'AMMUNITION', name: `${nameOf(it.id)} ammo +${it.rounds}`, sub: owned ? `${st.clip} in clip, ${st.ammo} in reserve` : 'Buy the weapon first', label, state, run: () => this.buyAmmo(it) });
    }
    const pl = g.player;
    const full = (pl?.armor ?? 0) >= 100;
    rows.push({ section: 'EQUIPMENT', name: 'Body Armor', sub: `Absorbs 70% of damage. You have ${Math.round(pl?.armor ?? 0)}%`, label: full ? 'FULL' : price(ARMOR.price), state: full ? 'off' : money < ARMOR.price ? 'poor' : 'ok', run: () => this.buyArmor() });
    return rows;
  }

  pay(amount) {
    const g = this.game;
    if ((g.state.money | 0) < amount) { g.audio?.play?.('deny'); this.menu.msg('Not enough cash', true); return false; }
    g.state.money -= amount;
    g.events.emit('money:changed', { money: g.state.money, delta: -amount });
    g.audio?.play?.('buy');
    return true;
  }
  done(text) { this.menu.msg(text); this.menu.render(); this.persist(); }
  deny(text) { this.game.audio?.play?.('deny'); this.menu.msg(text, true); }

  buyWeapon(it) {
    const w = this.game.player?.weapons; if (!w) return;
    const st = w.stateOf(it.id), d = WEAPON_DEFS.find(x => x.id === it.id);
    if (st.owned && !it.pack) return this.deny('You already own this');
    if (st.owned && st.ammo >= (d.maxReserve ?? 99)) return this.deny('Already full');
    if (!this.pay(it.price)) return;
    if (st.owned) w.addAmmo(it.id, it.pack);
    else { w.give(it.id); w.select(w.states.indexOf(st)); } // a new weapon goes straight into the hand
    this.done(`Bought ${nameOf(it.id)}`);
  }
  buyAmmo(it) {
    const w = this.game.player?.weapons; if (!w) return;
    const st = w.stateOf(it.id), d = WEAPON_DEFS.find(x => x.id === it.id);
    if (!st?.owned) return this.deny('Buy the weapon first');
    if (st.ammo >= (d.maxReserve ?? 9999)) return this.deny('Ammo is full');
    if (!this.pay(it.price)) return;
    w.addAmmo(it.id, it.rounds);
    this.done(`+${it.rounds} ${nameOf(it.id)} ammo`);
  }
  buyArmor() {
    const pl = this.game.player; if (!pl) return;
    if ((pl.armor ?? 0) >= 100) return this.deny('Armor is full');
    if (!this.pay(ARMOR.price)) return;
    pl.addArmor?.(ARMOR.amount);
    this.done('Body armor equipped');
  }

  // ---------- persistence ----------
  persist() {
    const w = this.game.player?.weapons; if (!w || !this.restored || this.disabled || this.game.save?.disabled) return;
    try {
      const owned = [], ammo = {};
      for (const s of w.states) if (s.owned && Number.isFinite(s.ammo)) { owned.push(s.id); ammo[s.id] = { ammo: s.ammo, clip: s.clip }; }
      localStorage.setItem(KEY, JSON.stringify({ v: 1, owned, ammo }));
    } catch (e) { /* storage unavailable */ }
  }
  restore() {
    const w = this.game.player?.weapons; if (!w) return;
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && d.v === 1 && Array.isArray(d.owned)) for (const id of d.owned) {
        const s = w.stateOf(id); if (!s || typeof id !== 'string') continue;
        s.owned = true;
        const a = d.ammo?.[id], def = WEAPON_DEFS.find(x => x.id === id);
        // broken or missing ammo data: fall back to the starting ammo of the weapon (never an unusable 0 / 0)
        if (a && Number.isFinite(a.ammo) && Number.isFinite(a.clip)) { s.ammo = Math.max(0, Math.min(def.maxReserve ?? 9999, a.ammo | 0)); s.clip = Math.max(0, Math.min(def.clipSize, a.clip | 0)); }
        else { s.clip = Math.min(def.clipSize, def.ammo); s.ammo = Math.max(0, def.ammo - s.clip); }
      }
    } catch (e) { /* ignore a broken record */ }
    w.refreshVisual?.();
  }

  // ---------- frame ----------
  update(dt) {
    const g = this.game, p = g.player;
    // first frame after Save.load() (Save is registered before us): apply the stored arsenal
    if (!this.restored) { if (g.save && !g.save.loaded) return; this.restore(); this.restored = true; }
    if (!this.placed) return;
    // marker animation
    this.t += dt;
    const sf = this.sf, k = 0.8 + 0.2 * Math.sin(this.t * 3);
    sf.ring.scale.setScalar(k); sf.ring.material.opacity = 0.55 + 0.3 * Math.sin(this.t * 3);
    sf.beam.material.opacity = 0.26 + 0.08 * Math.sin(this.t * 2.2);
    this.saveT += dt; if (this.saveT > 10) { this.saveT = 0; this.persist(); }
    if (!p || p.alive === false) { if (this.isOpen) this.close(); return; }
    const d = Math.hypot(p.position.x - this.position.x, p.position.z - this.position.z);
    if (this.isOpen) { this.menu.cashEl.textContent = '$' + (g.state.money | 0).toLocaleString('en-US'); return; }
    if (d > RADIUS + 1.5) this.armed = true;
    if (d < RADIUS && this.armed && !p.vehicle && !g.paused) { this.armed = false; this.open(); }
  }
}
