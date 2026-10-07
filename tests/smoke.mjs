// Smoke test: boots the game in headless Chromium, drives it for a few seconds,
// fails on any console error / page error, and writes screenshots to tests/screenshots/.
// Usage: npm run smoke            (optional env: SMOKE_SECONDS=8)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const seconds = Number(process.env.SMOKE_SECONDS || 6);
mkdirSync('tests/screenshots', { recursive: true });
const server = await createServer({ server: { port: 5300 + Math.floor(Math.random() * 600), strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e.stack || e)));
await page.goto(url);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 180000 });
await page.screenshot({ path: 'tests/screenshots/01-start.png' });

const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
await hold('KeyW', 1500);
await page.screenshot({ path: 'tests/screenshots/02-walk.png' });
// Try to get into the nearest car (teleport next to it if the vehicle API exists).
await page.evaluate(() => {
  const g = window.game, v = g.vehicles?.list?.find(v => !v.driver);
  if (v && g.player?.position) { g.player.position.set(v.position.x + 2, 0, v.position.z); }
});
await page.keyboard.press('KeyF');
await page.waitForTimeout(500);
await hold('KeyW', Math.max(1000, (seconds - 3) * 1000));
await page.screenshot({ path: 'tests/screenshots/03-drive.png' });
const state = await page.evaluate(() => {
  const g = window.game;
  return {
    time: g.time.toFixed(1),
    systems: g.systems.map(s => s.name),
    inVehicle: !!g.player?.vehicle,
    playerPos: g.player?.position ? [g.player.position.x, g.player.position.z].map(n => n.toFixed(1)) : null,
    vehicles: g.vehicles?.list?.length ?? null,
    peds: g.peds?.list?.length ?? null,
    wanted: g.state.wanted, money: g.state.money,
    drawCalls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles,
  };
});
console.log(JSON.stringify(state, null, 2));
await browser.close();
await server.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('SMOKE OK');
