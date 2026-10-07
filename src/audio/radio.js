// Procedural radio: three original stations scheduled with a lookahead timer.

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

export const STATIONS = [
  { name: 'Neon FM', bpm: 118 },
  { name: 'Bay Beats', bpm: 82 },
  { name: 'Static Talk', bpm: 120 },
];

export class Radio {
  constructor(ctx, out, noise) {
    this.ctx = ctx; this.out = out; this.noise = noise;
    this.index = -1;           // -1 = off
    this.bus = null; this.timer = null; this.step = 0; this.next = 0;
  }
  get name() { return this.index < 0 ? 'Off' : STATIONS[this.index].name; }
  cycle() { this.tune(this.index + 1 >= STATIONS.length ? -1 : this.index + 1); return this.name; }
  tune(i) {
    this.halt();
    this.index = i;
    if (i >= 0) this.begin();
  }
  /** Stop sound but remember the station (used when leaving the car). */
  halt() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    const bus = this.bus; this.bus = null;
    if (bus) {
      try {
        const t = this.ctx.currentTime;
        bus.gain.cancelScheduledValues(t); bus.gain.setTargetAtTime(0, t, 0.05);
        setTimeout(() => { try { bus.disconnect(); } catch (e) {} }, 600);
      } catch (e) {}
    }
  }
  resume() { if (this.index >= 0 && !this.timer) this.begin(); }
  begin() {
    const ctx = this.ctx;
    this.bus = ctx.createGain(); this.bus.gain.value = 1; this.bus.connect(this.out);
    this.step = 0; this.next = ctx.currentTime + 0.08;
    this.bar = 0;
    this.timer = setInterval(() => { try { this.pump(); } catch (e) {} }, 60);
  }
  pump() {
    const st = STATIONS[this.index];
    const per = this.index === 0 ? 60 / st.bpm / 4 : this.index === 1 ? 60 / st.bpm / 4 : 0.125;
    if (this.next < this.ctx.currentTime - 0.5) this.next = this.ctx.currentTime + 0.05; // tab was suspended
    while (this.next < this.ctx.currentTime + 0.2) {
      let swing = 0;
      if (this.index === 1 && this.step % 2 === 1) swing = per * 0.28;
      const fn = this.index === 0 ? this.neon : this.index === 1 ? this.bay : this.talk;
      fn.call(this, this.step, this.next + swing, per);
      this.step++; this.next += per;
    }
  }

  // ---- building blocks ----
  tone(t, type, freq, dur, peak, cutoff = 0, a = 0.005) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = o;
    if (cutoff) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * 0.25), t + dur); o.connect(f); n = f; }
    n.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  kick(t, p = 0.9) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(p, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 0.25);
  }
  noiseHit(t, ftype, freq, dur, peak) {
    const ctx = this.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.noise; s.loop = true;
    f.type = ftype; f.frequency.value = freq; f.Q.value = 0.8;
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.bus);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  snare(t, p = 0.5) { this.noiseHit(t, 'highpass', 1800, 0.16, p); this.tone(t, 'triangle', 190, 0.08, p * 0.6); }
  hat(t, p = 0.18, d = 0.04) { this.noiseHit(t, 'highpass', 7500, d, p); }

  // ---- Neon FM: synthwave ----
  neon(step, t) {
    const s = step % 16, bar = Math.floor(step / 16) % 4;
    const roots = [45, 41, 36, 43];                       // A F C G (bass octave)
    const chords = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];
    const minor = bar === 0;
    const ch = minor ? [0, 3, 7] : chords[bar];
    const root = roots[bar];
    if (s % 4 === 0) this.kick(t, 0.8);
    if (s === 4 || s === 12) this.snare(t, 0.45);
    if (s % 2 === 1) this.hat(t, 0.12);
    if (s % 4 === 2) this.hat(t, 0.07, 0.09);
    if (s % 2 === 0) this.tone(t, 'sawtooth', mtof(root + (s % 8 === 6 ? 12 : 0)), 0.2, 0.22, 700);
    const arp = [0, 1, 2, 1, 2, 1, 0, 1][s % 8];
    const note = root + 24 + ch[arp % 3] + (arp === 2 && s % 8 > 3 ? 12 : 0);
    this.tone(t, 'square', mtof(note), 0.16, 0.07, 3200);
    if (s === 0) for (const c of ch) this.tone(t, 'sawtooth', mtof(root + 24 + c), 1.9, 0.045, 1800, 0.1);
  }

  // ---- Bay Beats: lo-fi hip-hop ----
  bay(step, t) {
    const s = step % 32, prog = Math.floor(step / 32) % 4;
    const chords = [[50, 53, 57, 60], [46, 50, 53, 57], [43, 47, 50, 53], [45, 49, 52, 55]];
    if (s === 0 || s === 7 || s === 10 || s === 16 || s === 23) this.kick(t, 0.75);
    if (s === 8 || s === 24) this.snare(t, 0.35);
    if (s % 2 === 0) this.hat(t, s % 8 === 0 ? 0.14 : 0.08, 0.05);
    if (s === 0 || s === 14) for (const n of chords[prog]) this.tone(t + Math.random() * 0.02, 'triangle', mtof(n), 1.5, 0.07, 900, 0.02);
    if (s % 16 === 0) this.tone(t, 'sine', mtof(chords[prog][0] - 24), 1.2, 0.35, 0, 0.01);
    if (s === 11 || s === 27) this.tone(t, 'sine', mtof(chords[prog][0] - 12), 0.5, 0.25, 0);
    if (s === 20) this.tone(t, 'triangle', mtof(chords[prog][3] + 12), 0.4, 0.06, 1200);
    if (Math.random() < 0.15) this.noiseHit(t, 'highpass', 5000, 0.015, 0.05); // vinyl crackle
  }

  // ---- Static Talk: murmuring blips ----
  talk(step, t) {
    if (!this.tk) this.tk = { left: 0, base: 120, rest: 0 };
    const k = this.tk;
    if (k.rest > 0) { k.rest--; if (Math.random() < 0.15) this.noiseHit(t, 'bandpass', 2000 + Math.random() * 4000, 0.05, 0.04); return; }
    if (k.left <= 0) { k.left = 6 + Math.floor(Math.random() * 12); k.base = 90 + Math.random() * 120; }
    k.left--;
    if (k.left === 0) { k.rest = 6 + Math.floor(Math.random() * 14); if (Math.random() < 0.4) this.noiseHit(t, 'bandpass', 1500, 0.4, 0.1); return; }
    if (Math.random() < 0.7) {
      const ctx = this.ctx, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      const d = 0.06 + Math.random() * 0.08;
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(k.base * (0.8 + Math.random() * 0.6), t);
      f.type = 'bandpass'; f.Q.value = 6; f.frequency.setValueAtTime(400 + Math.random() * 1600, t);
      f.frequency.linearRampToValueAtTime(400 + Math.random() * 1600, t + d);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35, t + 0.01); g.gain.linearRampToValueAtTime(0.0001, t + d);
      o.connect(f); f.connect(g); g.connect(this.bus); o.start(t); o.stop(t + d + 0.02);
    }
    if (Math.random() < 0.06) this.tone(t, 'sine', 800 + Math.random() * 1200, 0.1, 0.1);
  }
}
