// One-shot synthesized sound effects. Each function receives (ctx, out, noise, t0, vol) where
// `out` is an AudioNode to connect to and `noise` a shared white-noise AudioBuffer.

function env(ctx, g, t, a, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone(ctx, out, t, type, f0, f1, dur, peak, a = 0.004, filt) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  env(ctx, g, t, a, peak, dur);
  let n = o;
  if (filt) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filt; o.connect(f); n = f; }
  n.connect(g); g.connect(out);
  o.start(t); o.stop(t + dur + 0.05);
}

function noiseBurst(ctx, out, noise, t, ftype, f0, f1, dur, peak, q = 0.7, a = 0.002) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise;
  s.loopStart = 0; s.loop = true;
  f.type = ftype; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(ctx, g, t, a, peak, dur);
  s.connect(f); f.connect(g); g.connect(out);
  s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
}

export const SFX = {
  gunshot(ctx, out, noise, t, v) {
    noiseBurst(ctx, out, noise, t, 'highpass', 900, 400, 0.22, 0.9 * v, 0.5);
    noiseBurst(ctx, out, noise, t, 'lowpass', 2500, 300, 0.35, 0.5 * v, 0.5);
    tone(ctx, out, t, 'sine', 180, 40, 0.18, 0.9 * v);
  },
  smg(ctx, out, noise, t, v) {
    noiseBurst(ctx, out, noise, t, 'bandpass', 2200, 900, 0.1, 0.7 * v, 0.6);
    tone(ctx, out, t, 'triangle', 220, 70, 0.08, 0.6 * v);
  },
  punch(ctx, out, noise, t, v) {
    tone(ctx, out, t, 'sine', 140, 45, 0.14, 0.9 * v);
    noiseBurst(ctx, out, noise, t, 'lowpass', 900, 200, 0.09, 0.5 * v);
  },
  hit(ctx, out, noise, t, v) {
    noiseBurst(ctx, out, noise, t, 'bandpass', 1800, 700, 0.06, 0.6 * v, 1.2);
    tone(ctx, out, t, 'triangle', 320, 140, 0.07, 0.4 * v);
  },
  explosion(ctx, out, noise, t, v) {
    noiseBurst(ctx, out, noise, t, 'lowpass', 1800, 60, 1.8, 1.0 * v, 0.7, 0.01);
    noiseBurst(ctx, out, noise, t, 'bandpass', 300, 80, 1.0, 0.7 * v, 0.5, 0.01);
    tone(ctx, out, t, 'sine', 90, 22, 1.4, 1.0 * v, 0.01);
    tone(ctx, out, t + 0.15, 'sawtooth', 60, 25, 0.9, 0.3 * v, 0.02, 200);
  },
  horn(ctx, out, noise, t, v) {
    for (const f of [392, 494]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = f;
      lp.type = 'lowpass'; lp.frequency.value = 1400;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.28 * v, t + 0.02);
      g.gain.setValueAtTime(0.28 * v, t + 0.38);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(lp); lp.connect(g); g.connect(out);
      o.start(t); o.stop(t + 0.55);
    }
  },
  crash(ctx, out, noise, t, v) {
    noiseBurst(ctx, out, noise, t, 'bandpass', 1500, 500, 0.5, 0.9 * v, 0.8);
    noiseBurst(ctx, out, noise, t, 'lowpass', 600, 80, 0.4, 0.8 * v);
    tone(ctx, out, t, 'sine', 100, 35, 0.3, 0.9 * v);
    for (const f of [410, 677, 1130]) tone(ctx, out, t + Math.random() * 0.04, 'square', f, f * 0.9, 0.25, 0.08 * v, 0.002, 3000);
  },
  pickup(ctx, out, noise, t, v) {
    tone(ctx, out, t, 'square', 988, 988, 0.08, 0.18 * v, 0.003, 4000);
    tone(ctx, out, t + 0.08, 'square', 1319, 1319, 0.22, 0.18 * v, 0.003, 4000);
  },
  mission(ctx, out, noise, t, v) {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const tt = t + i * 0.11, d = i === notes.length - 1 ? 0.7 : 0.16;
      tone(ctx, out, tt, 'triangle', f, f, d, 0.35 * v, 0.005);
      tone(ctx, out, tt, 'square', f * 2, f * 2, d * 0.8, 0.06 * v, 0.005, 3000);
    });
  },
  wasted(ctx, out, noise, t, v) {
    tone(ctx, out, t, 'sawtooth', 110, 38, 3.2, 0.5 * v, 0.05, 400);
    tone(ctx, out, t, 'sine', 55, 30, 3.2, 0.7 * v, 0.05);
    tone(ctx, out, t, 'triangle', 164.8, 80, 2.4, 0.25 * v, 0.1, 500);
    noiseBurst(ctx, out, noise, t, 'lowpass', 800, 60, 2.5, 0.35 * v, 0.7, 0.05);
  },
};
