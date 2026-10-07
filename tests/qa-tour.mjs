// QA tour: boots the game headless and captures screenshots of key situations
// (close-ups, night, combat, wanted, mission, explosion) into tests/screenshots/qa-*.png.
// Usage: node tests/qa-tour.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('tests/screenshots', { recursive: true });
const server = await createServer({ server: { port: 5900 + Math.floor(Math.random() * 400) }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e.stack || e)));
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 180000 });
await page.keyboard.press('Enter');

const shot = async (name, waitGameSec = 0.6) => {
  const t0 = await page.evaluate(() => window.game.time);
  await page.waitForFunction(t => window.game.time > t, t0 + waitGameSec, { timeout: 120000 });
  await page.screenshot({ path: `tests/screenshots/qa-${name}.png` });
  console.log('shot', name);
};
const ev = (fn, arg) => page.evaluate(fn, arg);

// 1. Character close-up
await ev(() => { const g = window.game; g.player.cameraRig && (g.player.cameraRig.distance = 2.5); });
await shot('player');

// 2. Pedestrians close-up: teleport player next to a ped
await ev(() => { const g = window.game, p = g.peds.list.find(p => p.alive && !p.isCop); if (p) g.player.teleport?.(p.position.x + 2, p.position.z + 2); });
await shot('peds', 1);

// 3. Vehicle close-up: put player beside a parked car
await ev(() => { const g = window.game, v = g.vehicles.list.find(v => !v.driver); if (v) g.player.teleport?.(v.position.x + 3, v.position.z + 3); });
await shot('car', 1);

// 4. Shooting + wanted level
await ev(() => { const g = window.game; g.police.setWanted?.(3); });
for (let i = 0; i < 6; i++) { await page.keyboard.press('ControlLeft'); await page.waitForTimeout(120); }
await shot('wanted', 4);

// 5. Explosion
await ev(() => { const g = window.game, v = g.vehicles.getNearest(g.player.position.x, g.player.position.z, 60); if (v) g.vehicles.damage(v, 1000); });
await shot('explosion', 0.4);

// 6. Night
await ev(() => { const g = window.game; g.police.setWanted?.(0); g.world.timeOfDay = 22.5; });
await shot('night', 1);

// 7. Night driving with traffic
await ev(() => { const g = window.game, v = g.vehicles.list.find(v => !v.driver && !v.destroyed); if (v) { g.player.teleport?.(v.position.x + 2, v.position.z); } });
await page.keyboard.press('KeyF');
await page.keyboard.down('KeyW'); await shot('night-drive', 3); await page.keyboard.up('KeyW');

// 8. Mission
await ev(() => { const g = window.game; g.world.timeOfDay = 17.5; if (g.player.vehicle) g.vehicles.exit(g.player.vehicle); g.missions.start('hotwheels'); });
await shot('mission', 1.5);

// 9. Beach / sea overview from high up
await ev(() => { const g = window.game; g.world.timeOfDay = 12; g.player.teleport?.(150, 170); });
await shot('beach', 1.5);

const stats = await ev(() => {
  const g = window.game;
  return { draw: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, geom: g.renderer.info.memory.geometries, tex: g.renderer.info.memory.textures, missions: Object.keys(g.missions) };
});
console.log(JSON.stringify(stats));
await browser.close(); await server.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('QA OK');
