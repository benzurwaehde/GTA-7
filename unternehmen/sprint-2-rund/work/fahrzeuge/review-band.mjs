// Review: find source of the black band seen in explosion shots. Run via tools/heavy.sh.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const OUT = 'unternehmen/sprint-2-rund/work/fahrzeuge/review-shots';
const server = await createServer({ server: { port: 6800 + Math.floor(Math.random() * 300), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 180000 });
await page.keyboard.press('Enter');
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = async s => { const t0 = await ev(() => window.game.time); await page.waitForFunction(t => window.game.time > t, t0 + s, { timeout: 120000 }); };
const shot = async n => { await wait(0.15); await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('shot', n); };
await ev(() => {
  const g = window.game, r = g.renderer.render.bind(g.renderer);
  g.renderer.render = (s, c) => { window.__cam?.(c); r(s, c); };
  g.vehicles.manage = () => {};
  for (const v of g.vehicles.list.slice()) g.vehicles.remove(v);
  window.__setCam = (px, py, pz, tx, ty, tz) => { window.__cam = c => { c.position.set(px, py, pz); c.lookAt(tx, ty, tz); }; };
});
const R = await ev(async () => { const cfg = await import('/src/core/config.js'); const R = cfg.ROAD_LINES[3]; window.game.player.teleport?.(R + 60, R + 60); return R; });
await ev(({ R }) => {
  const g = window.game; g.world.timeOfDay = 15;
  const v = g.vehicles.spawn('sedan', R + 40, R + 3.5, Math.PI / 2, { driver: null }); window.__ex = v;
  window.__setCam(R + 40 - 9, 3.2, R + 3.5 + 11, R + 40, 3, R + 3.5);
}, { R });
await shot('band-0-before');
await ev(() => window.game.vehicles.damage(window.__ex, 1000));
await shot('band-1-after');
// hide effect meshes
await ev(() => { const e = window.game.vehicles.effects; window.__eff = [e.smoke.mesh, e.fire.mesh, e.debris.mesh, e.skids.mesh, e.pools.mesh]; for (const m of window.__eff) m.visible = false; });
await shot('band-2-effects-hidden');
const info = await ev(() => {
  const g = window.game, big = [];
  g.scene.traverse(o => { if (o.isMesh && o.visible) { const b = new (o.geometry.boundingBox?.constructor || Object)(); } });
  return { shadowOn: g.renderer.shadowMap.enabled };
});
console.log(JSON.stringify(info));
// toggle shadow casting off for everything
await ev(() => { window.game.scene.traverse(o => { if (o.isLight && o.shadow) { window.__sh = (window.__sh || []); window.__sh.push([o, o.castShadow]); o.castShadow = false; } }); });
await shot('band-3-shadows-off');
await browser.close(); await server.close();
console.log(errors.join('\n') || 'no errors');
