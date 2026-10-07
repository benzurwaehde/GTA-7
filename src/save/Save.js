import { CITY } from '../core/config.js';

const KEY = 'gta7.save', VERSION = 1, INTERVAL = 30;
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null);

// Autosave to localStorage: money, finished missions, weapon ammo, time of day, player position.
// A broken or outdated save is ignored, never fatal.
export class Save {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.loaded = false;
    this.disabled = false;
    game.events.on('mission:completed', () => this.save());
  }

  read() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      return d && typeof d === 'object' && d.v === VERSION ? d : null;
    } catch (e) { return null; }
  }

  get hasSave() { return !!this.read(); }

  save() {
    const g = this.game, p = g.player;
    if (this.disabled || !this.loaded || !p || p.alive === false) return false;
    try {
      const ammo = {};
      for (const s of p.weapons?.states || []) if (Number.isFinite(s.ammo)) ammo[s.id] = { ammo: s.ammo, clip: Number.isFinite(s.clip) ? s.clip : undefined };
      const d = {
        v: VERSION, money: g.state.money | 0,
        completed: g.missions?.completed || [],
        ammo, time: g.world?.timeOfDay,
        pos: { x: p.position.x, z: p.position.z },
      };
      localStorage.setItem(KEY, JSON.stringify(d));
      return true;
    } catch (e) { return false; }
  }

  load() {
    const g = this.game, d = this.read();
    if (!d) return false;
    try {
      const money = num(d.money, 0, 1e9); if (money !== null) g.state.money = Math.floor(money);
      if (Array.isArray(d.completed) && g.missions) {
        for (const id of d.completed) if (typeof id === 'string' && !g.missions.completed.includes(id)) g.missions.completed.push(id);
        g.missions.save?.();
      }
      const states = g.player?.weapons?.states;
      if (d.ammo && typeof d.ammo === 'object' && states) {
        for (const s of states) {
          const a = d.ammo[s.id]; if (!a || !Number.isFinite(s.ammo)) continue;
          const n = num(a.ammo, 0, 9999); if (n !== null) s.ammo = n;
          const c = num(a.clip, 0, 999); if (c !== null && Number.isFinite(s.clip)) s.clip = c;
        }
      }
      const tod = num(d.time, 0, 24); if (tod !== null && g.world) g.world.timeOfDay = tod % 24;
      const x = num(d.pos?.x, -CITY.half, CITY.half), z = num(d.pos?.z, -CITY.half, CITY.half);
      if (x !== null && z !== null && g.player?.teleport) {
        g.player.teleport(x, z);
        g.player.cam?.snap?.(g.player.heading);
      }
      g.events.emit('money:changed', { money: g.state.money, delta: 0 });
      g.events.emit('hud:message', { text: 'Game loaded', duration: 2.5 });
      return true;
    } catch (e) { console.warn('[save] load failed', e); return false; }
  }

  // wipe everything and restart from scratch
  newGame() {
    this.disabled = true;
    try { localStorage.removeItem(KEY); localStorage.removeItem('gta7.missions.completed'); } catch (e) { /* ignore */ }
    location.reload();
  }

  update(dt) {
    // first frame: the player has spawned by now (Player is registered before us), so we can overwrite its position
    if (!this.loaded) { this.load(); this.loaded = true; return; }
    this.t += dt;
    if (this.t >= INTERVAL) { this.t = 0; this.save(); }
  }
}
