// Review: real game.world.signalAt (no mock), light counts, night spot, fallback without GLB. Run via tools/heavy.sh.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ server: { port: 6500 + Math.floor(Math.random() * 300), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
async function boot(noGlb) {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('console', m => { if (m.type() === 'error') errors.push((noGlb ? '[noglb] ' : '') + m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  if (noGlb) await page.route('**/models/car_*.glb*', r => r.abort());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 180000 });
  await page.keyboard.press('Enter');
  return page;
}
// ---- 1) real signals, normal traffic
let page = await boot(false);
await page.evaluate(() => {
  const g = window.game;
  window.__viol = []; window.__cross = 0; window.__prev = new Map(); window.__stopped = 0;
  const cfgP = import('/src/core/config.js');
  cfgP.then(cfg => {
    const R = cfg.ROAD_LINES, HW = cfg.CITY.roadWidth / 2;
    const sigAt = (x, z, axis, back) => { const t = g.time; g.time = t - back; const s = g.world.signalAt(x, z, axis); g.time = t; return s; };
    const loop = () => {
      for (const v of g.vehicles.list) {
        if (v.driver !== 'npc' || v.destroyed) continue;
        const ns = Math.abs(Math.cos(v.heading)) > 0.7, dir = ns ? Math.sign(Math.cos(v.heading)) : Math.sign(Math.sin(v.heading));
        const along = ns ? v.position.z : v.position.x, lat = ns ? v.position.x : v.position.z;
        const nose = along + dir * v.spec.L / 2;
        for (const cA of R) {
          // intersection with cross road at coordinate cA; need the lane road nearest to us
          let cl = R[0]; for (const r of R) if (Math.abs(r - lat) < Math.abs(cl - lat)) cl = r;
          if (Math.abs(cl - lat) > 6) continue;
          const key = v.id ?? (v.__k ||= Math.random()); const k2 = key + ':' + cA;
          const off = (nose - (cA - dir * HW)) * dir;   // >0 once the nose crossed the stop line
          const p = window.__prev.get(k2);
          window.__prev.set(k2, off);
          if (p !== undefined && p < 0 && off >= 0 && off < 2) {
            const ix = ns ? cl : cA, iz = ns ? cA : cl, ax = ns ? 'ns' : 'ew';
            const now = sigAt(ix, iz, ax, 0), before = sigAt(ix, iz, ax, 1.5);
            window.__cross++;
            if (now === 'red' && before === 'red' && Math.abs(v.speed) > 1) window.__viol.push({ ax, now, before, speed: +v.speed.toFixed(1), t: +g.time.toFixed(1) });
          }
        }
      }
      requestAnimationFrame(loop);
    };
    loop();
  });
});
const t0 = await page.evaluate(() => window.game.time);
// also: count of cars standing near red lights
let maxStopped = 0;
while (true) {
  const r = await page.evaluate(async () => {
    const cfg = await import('/src/core/config.js'), g = window.game, R = cfg.ROAD_LINES;
    let st = 0;
    for (const v of g.vehicles.list) if (v.driver === 'npc' && Math.abs(v.speed) < 0.3) {
      for (const a of R) for (const b of R) { const d = Math.hypot(v.position.x - a, v.position.z - b); if (d > 9 && d < 22 && g.world.signalAt(a, b, Math.abs(Math.cos(v.heading)) > 0.7 ? 'ns' : 'ew') === 'red') st++; }
    }
    return { t: g.time, st, cross: window.__cross, viol: window.__viol };
  });
  maxStopped = Math.max(maxStopped, r.st);
  if (r.t > t0 + 75) { console.log('REAL-SIGNAL cross events', r.cross, 'violations', JSON.stringify(r.viol), 'max cars stopped near red', maxStopped); break; }
  await new Promise(r => setTimeout(r, 1000));
}
const sig = await page.evaluate(() => ({ type: typeof window.game.world.signalAt, v: window.game.world.signalAt(0, 0, 'ns') }));
console.log('signalAt', JSON.stringify(sig));
// ---- 2) lights at night
const lights = await page.evaluate(async () => {
  const g = window.game, cfg = await import('/src/core/config.js'), R = cfg.ROAD_LINES[3];
  g.world.timeOfDay = 22.5;
  const v = g.vehicles.spawn('sedan', R - 60, R + 3.5, Math.PI / 2, { driver: 'player' });
  g.player.vehicle = v; g.vehicles.enter(v, 'player');
  await new Promise(r => setTimeout(r, 2500));
  const L = []; g.scene.traverse(o => { if (o.isLight) L.push({ t: o.type, i: +o.intensity.toFixed(1), y: +o.position.y.toFixed(1) }); });
  const spot = g.vehicles.headSpot;
  return { L, spotIntensity: spot.intensity, nf: g.world.nightFactor, isNight: g.world.isNight, calls: g.renderer.info.render.calls, nVeh: g.vehicles.list.length, poolN: g.vehicles.effects.pools.n };
});
console.log('NIGHT', JSON.stringify(lights));
await page.close();
// ---- 3) fallback without GLB
page = await boot(true);
const fb = await page.evaluate(async () => {
  const g = window.game, cfg = await import('/src/core/config.js'), R = cfg.ROAD_LINES[3];
  const out = {};
  for (const t of ['sedan', 'sports', 'truck', 'taxi', 'police']) {
    const v = g.vehicles.spawn(t, R + 5, R + 3.5, 0, { driver: 'npc', speed: 5 });
    let tris = 0; v.mesh.traverse(o => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
    out[t] = { tris, hasWheelF: !!v.model.wheelF, hasSiren: !!v.model.red };
    g.vehicles.remove(v);
  }
  await new Promise(r => setTimeout(r, 1500));
  return { out, hasModel: g.assets?.hasModel?.('car_sedan') };
});
console.log('FALLBACK', JSON.stringify(fb));
await page.close();
await browser.close(); await server.close();
console.log('ERRORS', errors.length ? errors.join('\n') : 'none');
