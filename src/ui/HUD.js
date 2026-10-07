import { HUD_CSS } from './hudStyles.js';
import { Minimap } from './Minimap.js';

const KEYS = [
  ['WASD', 'Move'], ['Shift', 'Sprint'], ['Space', 'Jump / Handbrake'], ['Mouse', 'Look'],
  ['F', 'Enter / exit vehicle'], ['LMB / Ctrl', 'Shoot'], ['RMB', 'Aim'], ['R', 'Reload (on foot) / Radio'],
  ['Q / E / Wheel', 'Switch weapon'], ['H', 'Horn'], ['Esc', 'Pause'],
];
const VOL_KEY = 'gta7.volumes';
const VOLUMES = [['master', 'Master'], ['music', 'Music'], ['sfx', 'SFX']];
const loadVolumes = () => {
  const d = { master: 0.8, music: 0.6, sfx: 1 };
  try { const o = JSON.parse(localStorage.getItem(VOL_KEY) || '{}'); for (const [k] of VOLUMES) if (Number.isFinite(o[k])) d[k] = Math.min(1, Math.max(0, o[k])); } catch (e) { /* ignore */ }
  return d;
};
const WEAPON_SPREAD = { pistol: 0.012, smg: 0.04 };
const keysHtml = () => KEYS.map(([k, v]) => `<div><b>${k}</b>${v}</div>`).join('');
const fmtMoney = n => '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const el = (cls, html = '', tag = 'div') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

export class HUD {
  constructor(game) {
    this.game = game;
    this.shownMoney = game.state.money;
    this.lastWanted = game.state.wanted;
    this.lastDistrict = null;
    this.districtTimer = 0;
    this.titleVisible = true;
    this.muted = false;
    this.msgs = [];
    this.cache = {};
    this.lastBig = { text: '', t: -9 };
    this.pauseOpenedAt = -1;
    this.hadLock = false;
    this.volumes = loadVolumes();
    this.hitT = 0;

    const style = document.createElement('style'); style.textContent = HUD_CSS; document.head.appendChild(style);
    const root = this.root = el('', '', 'div'); root.id = 'hud-root'; root.classList.add('vb-hidden');
    game.ui.appendChild(root);
    this.build(root);
    this.bind();
  }

  build(root) {
    // top-right
    const tr = el('vb-tr vb-hud');
    this.clockEl = el('vb-clock');
    this.moneyEl = el('vb-money'); this.deltaEl = el('vb-delta'); this.moneyEl.appendChild(this.deltaEl);
    this.moneyTxt = document.createTextNode(''); this.moneyEl.prepend(this.moneyTxt);
    this.starsEl = el('vb-stars'); for (let i = 0; i < 5; i++) this.starsEl.appendChild(el('', '★', 'span'));
    this.weaponEl = el('vb-weapon');
    tr.append(this.clockEl, this.moneyEl, this.starsEl, this.weaponEl);

    // minimap + bars
    const mw = el('vb-mapwrap vb-hud');
    this.map = new Minimap(this.game);
    this.hpBar = el('vb-bar vb-hp', '<div></div>'); this.arBar = el('vb-bar vb-ar', '<div></div>');
    mw.append(this.map.canvas, el('vb-bars'));
    mw.lastChild.append(this.hpBar, this.arBar);

    // speedo
    this.speedEl = el('vb-speed vb-hud', '<div class="n">0</div><div class="u">km/h</div><div class="bar"><div></div></div>');
    this.districtEl = el('vb-district');
    // mission panel
    this.missionEl = el('vb-mission vb-hud', '<div class="t"></div><div class="o"></div><div class="p"></div><div class="tm"></div>');
    this.msgsEl = el('vb-msgs vb-hud');
    this.bigEl = el('vb-big');
    // crosshair (screen center) + hit marker
    this.crossEl = el('vb-cross', '<i class="u"></i><i class="d"></i><i class="l"></i><i class="r"></i><b></b>');
    this.hitEl = el('vb-hitmark', '<i></i><i></i>');

    // title
    this.titleEl = el('vb-title', `<div class="g">GTA 7</div><h1>VICE BAY</h1><h2>OPEN CITY</h2>
      <div class="play">Click to play</div><div class="vb-keys">${keysHtml()}</div>`);
    this.titleEl.querySelector('h1').textContent = 'VICE BAY';
    this.titleEl.querySelector('.g').textContent = 'GTA 7 —';

    // pause
    this.pauseEl = el('vb-pause');
    this.pauseEl.innerHTML = '<h3>PAUSED</h3>';
    this.btnResume = this.btn('Resume', () => this.setPause(false));
    this.btnControls = this.btn('Controls', () => this.controlsEl.classList.toggle('on'));
    this.btnGfx = this.btn('Shadows: On', () => this.toggleShadows());
    this.btnMute = this.btn('Sound: On', () => this.toggleMute());
    this.btnNew = this.btn('New Game', () => this.newGame());
    this.controlsEl = el('vb-keys', keysHtml());
    this.volsEl = el('vb-vols');
    for (const [ch, label] of VOLUMES) {
      const row = el('vb-vol', `<span>${label}</span>`);
      const inp = el('clickable', '', 'input'); inp.type = 'range'; inp.min = 0; inp.max = 100; inp.step = 1;
      inp.value = Math.round(this.volumes[ch] * 100);
      inp.addEventListener('input', () => this.setVolume(ch, inp.value / 100));
      inp.addEventListener('mousedown', e => e.stopPropagation());
      row.appendChild(inp); this.volsEl.appendChild(row);
      this.game.audio?.setVolume?.(ch, this.volumes[ch]);
    }
    this.pauseEl.append(this.btnResume, this.btnControls, this.btnGfx, this.btnMute, this.volsEl, this.btnNew, this.controlsEl);

    root.append(tr, mw, this.speedEl, this.districtEl, this.missionEl, this.msgsEl, this.bigEl, this.crossEl, this.hitEl, this.titleEl, this.pauseEl);
  }

  btn(label, fn) {
    const b = el('vb-btn clickable', label);
    b.addEventListener('click', e => { e.stopPropagation(); fn(); });
    return b;
  }

  bind() {
    const g = this.game, ev = g.events;
    ev.on('hud:message', m => m && this.message(m.text, m.duration));
    ev.on('hud:bigtext', m => m && this.bigText(m.text, m.color, m.duration));
    ev.on('money:changed', () => this.onMoney());
    ev.on('wanted:changed', () => this.flashStars());
    ev.on('ped:damaged', e => {
      if (!e || e.source !== 'player') return;
      const dead = e.ped && (e.ped.alive === false || e.ped.state === 'dead' || e.ped.health <= 0);
      this.hitT = dead ? 0.35 : 0.2;
      this.hitEl.classList.toggle('kill', !!dead);
      this.hitEl.classList.remove('show'); void this.hitEl.offsetWidth; this.hitEl.classList.add('show');
    });

    const dismiss = () => this.hideTitle();
    addEventListener('keydown', e => {
      if (this.titleVisible) { if (e.code !== 'Escape') dismiss(); return; }
      if (e.code === 'Escape' && !e.repeat) {
        if (performance.now() - this.pauseOpenedAt < 200) return; // pointer-lock exit already opened it
        this.setPause(!g.paused);
      }
    });
    addEventListener('mousedown', dismiss);
    document.addEventListener('pointerlockchange', () => {
      const locked = !!document.pointerLockElement;
      if (!locked && this.hadLock && !this.titleVisible && !g.paused) { this.pauseOpenedAt = performance.now(); this.setPause(true); }
      this.hadLock = locked;
    });
  }

  hideTitle() {
    if (!this.titleVisible) return;
    this.titleVisible = false;
    this.titleEl.classList.add('gone');
    this.root.classList.remove('vb-hidden');
    setTimeout(() => this.titleEl.remove(), 800);
  }

  setPause(on) {
    const g = this.game;
    g.paused = on;
    this.pauseEl.classList.toggle('on', on);
    if (!on) {
      this.controlsEl.classList.remove('on');
      try { g.renderer.domElement.requestPointerLock?.(); } catch (e) { /* needs a gesture */ }
    } else {
      this.btnMute.textContent = 'Sound: ' + (this.muted ? 'Off' : 'On');
      this.btnNew.textContent = 'New Game';
      try { document.exitPointerLock?.(); } catch (e) { /* ignore */ }
    }
  }

  toggleShadows() {
    const r = this.game.renderer, on = !r.shadowMap.enabled;
    r.shadowMap.enabled = on;
    this.game.scene.traverse(o => { const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { x.needsUpdate = true; }); });
    this.btnGfx.textContent = 'Shadows: ' + (on ? 'On' : 'Off');
  }

  toggleMute() {
    this.muted = !this.muted;
    this.game.audio?.setMuted?.(this.muted);
    this.btnMute.textContent = 'Sound: ' + (this.muted ? 'Off' : 'On');
  }

  setVolume(ch, v) {
    this.volumes[ch] = v;
    this.game.audio?.setVolume?.(ch, v);
    try { localStorage.setItem(VOL_KEY, JSON.stringify(this.volumes)); } catch (e) { /* ignore */ }
  }

  // two clicks: first arms the button, second wipes the save and reloads
  newGame() {
    if (!this.btnNew.classList.contains('armed')) {
      this.btnNew.classList.add('armed'); this.btnNew.textContent = 'Really? Click again';
      setTimeout(() => { this.btnNew.classList.remove('armed'); this.btnNew.textContent = 'New Game'; }, 3000);
      return;
    }
    if (this.game.save?.newGame) this.game.save.newGame();
    else { try { localStorage.removeItem('gta7.missions.completed'); } catch (e) { /* ignore */ } location.reload(); }
  }

  message(text, duration = 3.5) {
    if (!text) return;
    // the current objective lives in the top bar only
    if (text === this.game.missions?.active?.objectiveText) return;
    const m = el('vb-msg'); m.textContent = text;
    this.msgsEl.appendChild(m);
    this.msgs.push({ el: m, t: duration });
    while (this.msgs.length > 3) this.msgs.shift().el.remove();
  }

  bigText(text, color = '#fff', duration = 3) {
    if (!text) return;
    const now = performance.now() / 1000;
    if (this.lastBig.text === text && now - this.lastBig.t < 1.2) return; // dedupe duplicate emitters
    this.lastBig = { text, t: now };
    const b = this.bigEl;
    b.textContent = text; b.style.color = color; b.style.setProperty('--dur', duration + 's');
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }

  onMoney() {
    const delta = this.game.state.money - (this._lastMoney ?? this.shownMoney);
    this._lastMoney = this.game.state.money;
    if (!delta) return;
    this.moneyEl.classList.remove('pulse'); void this.moneyEl.offsetWidth; this.moneyEl.classList.add('pulse');
    const d = this.deltaEl; d.textContent = (delta > 0 ? '+' : '-') + fmtMoney(Math.abs(delta));
    d.classList.toggle('neg', delta < 0); d.classList.remove('show'); void d.offsetWidth; d.classList.add('show');
  }

  flashStars() {
    this.starsEl.classList.remove('flash'); void this.starsEl.offsetWidth; this.starsEl.classList.add('flash');
  }

  set(key, val, fn) { if (this.cache[key] !== val) { this.cache[key] = val; fn(val); } }

  update(dt) {
    const g = this.game, p = g.player, w = g.world;
    this.time = (this.time || 0) + dt;

    // clock
    const tod = w?.timeOfDay;
    if (typeof tod === 'number') {
      const h = Math.floor(tod) % 24, m = Math.floor((tod % 1) * 60);
      this.set('clock', `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, v => { this.clockEl.textContent = v; });
    }

    // money count-up (poll state too, other systems may not emit)
    const target = g.state.money;
    if (target !== this._lastMoney) this.onMoney();
    if (this.shownMoney !== target) {
      const diff = target - this.shownMoney;
      this.shownMoney += Math.sign(diff) * Math.max(1, Math.abs(diff) * Math.min(1, dt * 6));
      if (Math.abs(target - this.shownMoney) < 1) this.shownMoney = target;
    }
    this.set('money', Math.round(this.shownMoney), v => { this.moneyTxt.nodeValue = fmtMoney(v); });

    // stars
    const wanted = g.state.wanted | 0;
    if (wanted !== this.lastWanted) { this.lastWanted = wanted; this.flashStars(); }
    this.set('wanted', wanted, v => [...this.starsEl.children].forEach((s, i) => s.classList.toggle('on', i < v)));

    // weapon
    const wp = p?.weapon;
    if (wp) this.set('weapon', `${wp.name}|${wp.ammo}|${wp.id}|${wp.clip}|${wp.reloading}`, () => {
      const infinite = wp.id === 'fists' || wp.ammo == null || wp.ammo === Infinity;
      const hasClip = Number.isFinite(wp.clip);
      let info = '';
      if (!infinite) info = `<i>${hasClip ? `${wp.clip} / ${wp.ammo}` : wp.ammo}</i>`;
      if (wp.reloading) info += '<i class="rl">RELOADING</i>';
      this.weaponEl.innerHTML = `${wp.name || 'Fists'}${info}`;
    });
    this.updateCrosshair(dt, p, wp);

    // bars
    if (p) {
      const hp = Math.max(0, Math.min(100, p.health ?? 100)), ar = Math.max(0, Math.min(100, p.armor ?? 0));
      this.set('hp', hp, v => { this.hpBar.firstChild.style.width = v + '%'; this.hpBar.classList.toggle('low', v < 25); });
      this.set('ar', ar, v => { this.arBar.firstChild.style.width = v + '%'; this.arBar.style.opacity = v > 0 ? 1 : 0.35; });
    }

    // speedometer
    const veh = p?.vehicle;
    this.set('driving', !!veh, v => this.speedEl.classList.toggle('on', v));
    if (veh) {
      const kmh = Math.abs(veh.speed || 0) * 3.6;
      this.set('kmh', Math.round(kmh), v => { this.speedEl.querySelector('.n').textContent = v; this.speedEl.querySelector('.bar > div').style.width = Math.min(100, v / 2.2) + '%'; });
    }

    // district
    if (p && w?.districtAt) {
      this.districtTimer -= dt;
      if (this.districtTimer <= 0) {
        this.districtTimer = 0.3;
        const d = w.districtAt(p.position.x, p.position.z);
        if (d && d !== this.lastDistrict) {
          const first = this.lastDistrict === null;
          this.lastDistrict = d;
          if (!first || !this.titleVisible) this.showDistrict(d); else this.pendingDistrict = d;
        }
      }
    }
    if (this.pendingDistrict && !this.titleVisible) { this.showDistrict(this.pendingDistrict); this.pendingDistrict = null; }

    // mission panel
    const m = g.missions?.active;
    if (m) {
      this.missionEl.classList.add('on');
      const q = this.missionEl;
      this.set('mt', m.name, v => { q.querySelector('.t').textContent = v; });
      this.set('mo', m.objectiveText || '', v => { q.querySelector('.o').textContent = v; });
      this.set('mp', m.progress || '', v => { q.querySelector('.p').textContent = v; });
      const tl = m.timeLeft;
      const tmEl = q.querySelector('.tm');
      if (tl == null) this.set('tm', '', v => { tmEl.textContent = v; });
      else {
        const s = Math.max(0, Math.ceil(tl));
        this.set('tm', `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, v => { tmEl.textContent = v; });
        tmEl.classList.toggle('low', tl < 10);
      }
    } else if (this.cache.mt !== null) {
      this.missionEl.classList.remove('on'); this.cache.mt = null;
    }

    // messages
    for (let i = this.msgs.length - 1; i >= 0; i--) {
      const m2 = this.msgs[i]; m2.t -= dt;
      if (m2.t <= 0.5 && !m2.out) { m2.out = true; m2.el.classList.add('out'); }
      if (m2.t <= 0) { m2.el.remove(); this.msgs.splice(i, 1); }
    }

    this.map.draw(this.time);
  }

  updateCrosshair(dt, p, wp) {
    const g = this.game;
    const show = !g.paused && !this.titleVisible && !!p && p.alive !== false && !p.vehicle && !!wp && wp.id !== 'fists';
    this.set('cross', show, v => this.crossEl.classList.toggle('on', v));
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) this.hitEl.classList.remove('show'); }
    if (!show) return;
    const info = p.getAimInfo?.();
    const aiming = info ? !!info.aiming : !!g.input.mouse.right;
    const spread = info?.spread ?? WEAPON_SPREAD[wp.id] ?? 0.02;
    const gap = Math.round((4 + spread * 240) * (aiming ? 0.6 : 1));
    this.set('gap', gap, v => this.crossEl.style.setProperty('--gap', v + 'px'));
    this.set('aim', aiming, v => this.crossEl.classList.toggle('aim', v));
  }

  showDistrict(name) {
    const d = this.districtEl; d.textContent = name;
    d.classList.remove('show'); void d.offsetWidth; d.classList.add('show');
  }
}
