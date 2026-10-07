import { SFX } from './sfx.js';
import { Radio, STATIONS } from './radio.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAX_VOICES = 24;

export class AudioSystem {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.failed = false;
    this.muted = false;
    this.volumes = { master: 0.8, sfx: 1, music: 0.6, ambience: 0.6 };
    this.voices = 0;
    this.radio = null;
    this.engine = null; this.screech = null; this.siren = null; this.amb = null;
    this._lastHeading = 0; this._lastVeh = null; this._slip = 0;
    this._gesture = () => this.unlock();
    try {
      addEventListener('pointerdown', this._gesture);
      addEventListener('keydown', this._gesture);
    } catch (e) {}
    this._bindEvents();
  }

  // ---------- context ----------
  unlock() {
    try {
      if (!this.ctx && !this.failed) this._create();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch (e) { this.failed = true; }
  }

  _create() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.failed = true; return; }
    try {
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 20; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.2;
      this.master.connect(comp); comp.connect(ctx.destination);
      this.sfxBus = ctx.createGain(); this.musicBus = ctx.createGain(); this.ambBus = ctx.createGain();
      this.sfxBus.connect(this.master); this.musicBus.connect(this.master); this.ambBus.connect(this.master);
      this._applyVolumes();
      // shared looping white noise
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      this.radio = new Radio(ctx, this.musicBus, buf);
      this._buildAmbience();
    } catch (e) {
      this.ctx = null; this.failed = true;
    }
  }

  get ready() { return !!this.ctx && !this.failed; }

  _applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, v = this.volumes;
    this.master.gain.setTargetAtTime(this.muted ? 0 : v.master, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(v.sfx, t, 0.03);
    this.musicBus.gain.setTargetAtTime(v.music, t, 0.03);
    this.ambBus.gain.setTargetAtTime(v.ambience, t, 0.03);
  }
  setMuted(m) { this.muted = !!m; this._applyVolumes(); }
  setVolume(channel, v) {
    if (channel === 'ambient') channel = 'ambience';
    if (!(channel in this.volumes)) return;
    this.volumes[channel] = clamp(Number(v) || 0, 0, 1);
    this._applyVolumes();
  }

  // ---------- helpers ----------
  _noiseSrc(filterType, freq, q = 0.7) {
    const ctx = this.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.noise; s.loop = true;
    f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    g.gain.value = 0;
    s.connect(f); f.connect(g);
    s.start(0, Math.random() * 1.5);
    return { src: s, filter: f, gain: g };
  }

  /** distance gain + stereo pan for a world position. Returns null if inaudible. */
  _spatial(x, z) {
    const p = this.game.player?.position;
    if (!p || x === undefined || z === undefined) return { vol: 1, pan: 0 };
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d > 180) return null;
    const vol = 1 / (1 + (d / 22) * (d / 22) * 0.35 + d / 40);
    let pan = 0;
    const m = this.game.camera?.matrixWorld?.elements;
    if (m && d > 1) pan = clamp(((dx * m[0] + dz * m[2]) / d) * 0.85, -1, 1);
    return { vol, pan };
  }

  // ---------- one-shots ----------
  play(name, opts = {}) {
    try {
      if (!this.ready || this.ctx.state !== 'running') return;
      const fn = SFX[name];
      if (!fn || this.voices >= MAX_VOICES) return;
      const sp = this._spatial(opts.x, opts.z);
      if (!sp) return;
      const vol = sp.vol * (opts.volume ?? 1);
      if (vol < 0.01) return;
      const ctx = this.ctx;
      const out = ctx.createGain();
      let node = out;
      if (ctx.createStereoPanner) {
        const pn = ctx.createStereoPanner(); pn.pan.value = sp.pan; out.connect(pn); node = pn;
      }
      node.connect(this.sfxBus);
      this.voices++;
      const life = { wasted: 3.6, explosion: 2.2, mission: 1.4 }[name] || 1;
      setTimeout(() => { this.voices--; try { node.disconnect(); out.disconnect(); } catch (e) {} }, life * 1000 + 200);
      fn(ctx, out, this.noise, ctx.currentTime + 0.005, vol);
    } catch (e) { /* audio is best-effort */ }
  }

  _bindEvents() {
    const ev = this.game.events;
    ev.on('vehicle:crash', ({ vehicle, impact } = {}) => {
      const v = clamp((impact ?? 8) / 14, 0.25, 1);
      if (impact !== undefined && impact < 2) return;
      this.play('crash', { x: vehicle?.position?.x, z: vehicle?.position?.z, volume: v });
    });
    ev.on('vehicle:destroyed', ({ vehicle } = {}) => this.play('explosion', { x: vehicle?.position?.x, z: vehicle?.position?.z }));
    ev.on('mission:completed', () => this.play('mission'));
    ev.on('player:died', () => this.play('wasted'));
    // money:changed intentionally ignored (senders call play('pickup') themselves)
  }

  // ---------- continuous ----------
  _buildAmbience() {
    const ctx = this.ctx;
    const wind = this._noiseSrc('lowpass', 500, 0.4);
    const traffic = this._noiseSrc('lowpass', 140, 0.8);
    const hiss = this._noiseSrc('bandpass', 3500, 0.6);
    for (const n of [wind, traffic, hiss]) n.gain.connect(this.ambBus);
    // slow wobble on wind
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.13; lg.gain.value = 180;
    lfo.connect(lg); lg.connect(wind.filter.frequency); lfo.start();
    this.amb = { wind, traffic, hiss };
  }

  _updateAmbience(dt) {
    if (!this.amb) return;
    const w = this.game.world;
    let day = 1;
    if (typeof w?.timeOfDay === 'number') {
      const h = w.timeOfDay;
      day = clamp(Math.sin(((h - 6) / 24) * Math.PI * 2) * 0.5 + 0.6, 0.25, 1);
    } else if (w?.isNight) day = 0.35;
    const t = this.ctx.currentTime;
    const inCar = this.game.player?.vehicle ? 0.5 : 1;
    this.amb.wind.gain.gain.setTargetAtTime(0.05 * (0.5 + day * 0.5) * inCar, t, 0.5);
    this.amb.traffic.gain.gain.setTargetAtTime(0.16 * day * inCar, t, 0.5);
    this.amb.hiss.gain.gain.setTargetAtTime(0.008 * day, t, 0.5);
  }

  _ensureEngine() {
    if (this.engine) return this.engine;
    const ctx = this.ctx;
    const gain = ctx.createGain(); gain.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 2;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'square';
    const o3 = ctx.createOscillator(); o3.type = 'sine';
    const g2 = ctx.createGain(); g2.gain.value = 0.4;
    const g3 = ctx.createGain(); g3.gain.value = 0.8;
    o1.connect(lp); o2.connect(g2); g2.connect(lp); o3.connect(g3); g3.connect(gain);
    const nz = this._noiseSrc('bandpass', 400, 0.8);
    nz.gain.connect(gain);
    lp.connect(gain); gain.connect(this.sfxBus);
    o1.start(); o2.start(); o3.start();
    this.engine = { gain, lp, o1, o2, o3, nz, gear: 0, rpm: 0, dip: 0, running: true };
    return this.engine;
  }

  _stopEngine() {
    const e = this.engine;
    if (!e) return;
    try { e.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08); } catch (er) {}
    setTimeout(() => {
      try { e.o1.stop(); e.o2.stop(); e.o3.stop(); e.nz.src.stop(); e.gain.disconnect(); e.nz.gain.disconnect(); } catch (er) {}
    }, 500);
    this.engine = null;
  }

  _updateEngine(dt, veh) {
    const e = this._ensureEngine(), t = this.ctx.currentTime;
    const sp = Math.abs(veh.speed || 0);
    const maxSp = { sports: 55, taxi: 40, police: 48, truck: 28, sedan: 38 }[veh.type] || 40;
    const gears = [0, 9, 18, 28, 40, 1e9].map(v => v * maxSp / 40);
    let g = 0;
    while (sp > gears[g + 1]) g++;
    if (g !== e.gear) { if (g > e.gear) e.dip = 1; e.gear = g; }
    e.dip = Math.max(0, e.dip - dt * 3.5);
    const span = Math.min(gears[g + 1] - gears[g], 14 * maxSp / 40);
    const frac = clamp((sp - gears[g]) / span, 0, 1);
    const target = 0.12 + frac * 0.88 - e.dip * 0.35;
    e.rpm += (target - e.rpm) * clamp(dt * 8, 0, 1);
    const base = veh.type === 'truck' ? 38 : veh.type === 'sports' ? 62 : 50;
    const f = base + e.rpm * (veh.type === 'sports' ? 150 : 115);
    const thr = veh.controls?.throttle ?? (this.game.input?.isDown?.('KeyW') ? 1 : 0);
    const load = 0.55 + 0.45 * clamp(Math.abs(thr), 0, 1);
    e.o1.frequency.setTargetAtTime(f, t, 0.04);
    e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.04);
    e.o3.frequency.setTargetAtTime(f * 0.25, t, 0.04);
    e.lp.frequency.setTargetAtTime(350 + e.rpm * 900 * load, t, 0.05);
    e.nz.filter.frequency.setTargetAtTime(300 + e.rpm * 1200, t, 0.05);
    e.nz.gain.gain.setTargetAtTime(0.05 + e.rpm * 0.12, t, 0.05);
    e.gain.gain.setTargetAtTime((0.10 + e.rpm * 0.10) * load * (veh.destroyed ? 0 : 1), t, 0.06);
  }

  _updateScreech(dt, veh) {
    let target = 0;
    if (veh) {
      const sp = Math.abs(veh.speed || 0);
      const h = veh.heading ?? 0;
      let dh = h - this._lastHeading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      const yaw = this._lastVeh === veh && dt > 0 ? Math.abs(dh / dt) : 0;
      this._lastHeading = h; this._lastVeh = veh;
      const hb = veh.controls?.handbrake ?? this.game.input?.isDown?.('Space');
      const lateral = yaw * sp;
      this._slip += (lateral - this._slip) * clamp(dt * 6, 0, 1);
      if (sp > 7 && hb) target = clamp(sp / 25, 0.3, 1);
      else if (sp > 10 && this._slip > 10) target = clamp((this._slip - 10) / 12, 0, 1);
    } else { this._lastVeh = null; this._slip = 0; }
    if (!this.screech) {
      if (target < 0.02) return;
      this.screech = this._noiseSrc('bandpass', 1700, 6);
      this.screech.gain.connect(this.sfxBus);
    }
    const s = this.screech, t = this.ctx.currentTime;
    s.gain.gain.setTargetAtTime(target * 0.09, t, 0.05);
    s.filter.frequency.setTargetAtTime(1500 + target * 700 + Math.sin(this.game.time * 40) * 80, t, 0.05);
    if (target < 0.02 && s.gain.gain.value < 0.002) {
      try { s.src.stop(); s.gain.disconnect(); } catch (e) {}
      this.screech = null;
    }
  }

  _updateSiren(dt) {
    const list = this.game.vehicles?.list;
    let near = Infinity;
    const p = this.game.player?.position;
    if (list && p) {
      for (let i = 0; i < list.length; i++) {
        const v = list[i];
        if (!v.sirenOn || v.destroyed) continue;
        const d = Math.hypot(v.position.x - p.x, v.position.z - p.z);
        if (d < near) near = d;
      }
    }
    const vol = near < 120 ? Math.pow(1 - near / 120, 1.5) : 0;
    if (!this.siren) {
      if (vol <= 0) return;
      const ctx = this.ctx;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 900;
      const lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 0.55;
      const lg = ctx.createGain(); lg.gain.value = 330;
      lfo.connect(lg); lg.connect(o.frequency);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      const g = ctx.createGain(); g.gain.value = 0;
      o.connect(lp); lp.connect(g); g.connect(this.sfxBus);
      o.start(); lfo.start();
      this.siren = { o, lfo, g, idle: 0 };
    }
    const s = this.siren, t = this.ctx.currentTime;
    s.g.gain.setTargetAtTime(vol * 0.16, t, 0.15);
    s.idle = vol <= 0 ? s.idle + dt : 0;
    if (s.idle > 1.5) {
      try { s.o.stop(); s.lfo.stop(); s.g.disconnect(); } catch (e) {}
      this.siren = null;
    }
  }

  _updateRadio(veh) {
    const r = this.radio, input = this.game.input;
    if (!r) return;
    if (veh) {
      if (input?.pressed?.('KeyR')) {
        const name = r.cycle();
        this.game.events.emit('hud:message', { text: '📻 ' + name, duration: 2 });
      } else r.resume();
    } else if (r.timer) r.halt();
  }

  update(dt) {
    try {
      if (!this.ready) return;
      if (this.ctx.state !== 'running') return;
      const veh = this.game.player?.vehicle || null;
      this._updateAmbience(dt);
      if (veh && !veh.destroyed) this._updateEngine(dt, veh); else if (this.engine) this._stopEngine();
      this._updateScreech(dt, veh);
      this._updateSiren(dt);
      this._updateRadio(veh);
    } catch (e) { /* never break the frame loop */ }
  }
}
export { STATIONS };
