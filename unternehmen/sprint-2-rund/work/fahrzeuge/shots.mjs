// Screenshots for T1 (fahrzeuge). Run from the project root: node unternehmen/sprint-2-rund/work/fahrzeuge/shots.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
const OUT = 'unternehmen/sprint-2-rund/work/fahrzeuge/shots';
const server = await createServer({ server: { port: 6100 + Math.floor(Math.random() * 400) }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e.stack || e)));
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 180000 });
await page.keyboard.press('Enter');
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = async s => { const t0 = await ev(() => window.game.time); await page.waitForFunction(t => window.game.time > t, t0 + s, { timeout: 120000 }); };
const shot = async (name, s = 0.5) => { await wait(s); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };

// free camera + clean street
await ev(() => {
  const g = window.game, r = g.renderer.render.bind(g.renderer);
  g.renderer.render = (s, c) => { window.__cam?.(c); r(s, c); };
  g.vehicles.manage = () => {};
  for (const v of g.vehicles.list.slice()) g.vehicles.remove(v);
  window.__setCam = (px, py, pz, tx, ty, tz) => { window.__cam = c => { c.position.set(px, py, pz); c.lookAt(tx, ty, tz); }; };
});
const base = await ev(async () => {
  const cfg = await import('/src/core/config.js');
  const g = window.game, R = cfg.ROAD_LINES[3];
  g.player.teleport?.(R + 60, R + 60);
  return { R };
});
const R = base.R;
// lineup along the east-west road (x axis), cars facing +x
await ev(({ R }) => {
  const g = window.game;
  window.__cars = ['sedan', 'sports', 'truck', 'taxi', 'police'].map((t, i) => g.vehicles.spawn(t, R - 12 + i * 6.2, R + 3, Math.PI / 2, { driver: null }));
  g.world.timeOfDay = 13;
}, { R });
await ev(({ R }) => window.__setCam(R - 4, 3.3, R + 17, R, 0.8, R + 3), { R });
await shot('lineup-day', 1);
await ev(({ R }) => window.__setCam(R - 20, 1.6, R + 8.5, R - 10, 0.8, R + 3), { R });
await shot('closeup-sedan', 0.5);
await ev(({ R }) => window.__setCam(R + 8, 1.5, R + 9, R + 4, 0.7, R + 3), { R });
await shot('closeup-police-taxi', 0.5);
// rear view
await ev(({ R }) => window.__setCam(R - 18, 2.4, R - 2, R + 2, 0.8, R + 3), { R });
await shot('rear-view', 0.5);

// night: drive lineup lights (put drivers in so lamps glow)
await ev(({ R }) => {
  const g = window.game;
  for (const v of window.__cars) { v.driver = 'npc'; v.ai = null; v.sleeping = false; v.controls.brake = 0; }
  g.world.timeOfDay = 22.5;
}, { R });
await ev(({ R }) => window.__setCam(R - 4, 3.3, R + 17, R, 0.8, R + 3), { R });
await shot('lineup-night', 1.5);
await ev(({ R }) => window.__setCam(R - 20, 1.6, R + 8.5, R - 10, 0.8, R + 3), { R });
await shot('closeup-night', 0.5);

// cleanup for the next scenes
await ev(() => { const g = window.game; for (const v of window.__cars) g.vehicles.remove(v); });

// player car at night with spot cone, then drift
await ev(({ R }) => {
  const g = window.game;
  const v = g.vehicles.spawn('sports', R - 60, R + 3.5, Math.PI / 2, { driver: 'player' });
  window.__pv = v; g.player.vehicle = v; g.vehicles.enter(v, 'player');
  v.speed = 18; v.vx = 18; v.vz = 0;
  window.__cam = null;
}, { R });
await wait(0.3);
await page.keyboard.down('KeyW');
await wait(1.5);
await page.screenshot({ path: `${OUT}/night-drive-spot.png` }); console.log('shot night-drive-spot');
// drift: handbrake + steer
await page.keyboard.down('KeyD'); await page.keyboard.down('Space');
await wait(1.2);
await page.keyboard.up('Space'); await page.keyboard.up('KeyD');
await ev(() => { const g = window.game; g.world.timeOfDay = 13; });
await wait(0.5);
await ev(() => { const v = window.__pv; const c = window.game.camera; });
await page.keyboard.up('KeyW');
const skidInfo = await ev(() => window.game.vehicles.effects.skids.active);
console.log('skid marks active', skidInfo);
await ev(() => window.__setCam && 0);
await shot('drift-skids', 0.8);
// top view of skid marks
await ev(() => { const v = window.__pv, p = v.position; window.__setCam(p.x - 6, 9, p.z + 8, p.x - 8, 0, p.z); });
await shot('skids-top', 0.3);

// explosion sequence
await ev(({ R }) => {
  const g = window.game; g.vehicles.remove(window.__pv); g.player.vehicle = null;
  const v = g.vehicles.spawn('sedan', R + 40, R + 3.5, Math.PI / 2, { driver: null });
  window.__ex = v; g.world.timeOfDay = 15;
  window.__setCam(R + 40 - 9, 3.2, R + 3.5 + 11, R + 40, 3, R + 3.5);
}, { R });
await wait(0.3);
await ev(() => window.game.vehicles.damage(window.__ex, 1000));
await shot('explosion-0', 0.12);
await shot('explosion-1', 0.35);
await shot('explosion-2', 0.9);
await shot('explosion-3', 1.8);
// night explosion
await ev(({ R }) => {
  const g = window.game; g.world.timeOfDay = 22.5;
  const v = g.vehicles.spawn('police', R + 70, R + 3.5, Math.PI / 2, { driver: null });
  window.__ex = v;
  window.__setCam(R + 70 - 9, 3.2, R + 3.5 + 11, R + 70, 3, R + 3.5);
}, { R });
await wait(0.3);
await ev(() => window.game.vehicles.damage(window.__ex, 1000));
await shot('explosion-night-0', 0.25);
await shot('explosion-night-1', 1.2);
console.log(JSON.stringify(await ev(() => ({ calls: window.game.renderer.info.render.calls }))));
await browser.close(); await server.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('SHOTS OK');
