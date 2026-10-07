// Smoke test for the packaged macOS app: launches release/mac-arm64/GTA 7 Vice Bay.app via the Chromium
// debug port, waits for the game loop, checks models loaded and no console errors, saves a screenshot.
// Connects over the Chromium debug port because packaged builds disable Node inspector flags.
// Usage: node tests/app-smoke.mjs   (after npm run dist:mac)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

mkdirSync('tests/screenshots', { recursive: true });
const exe = 'release/mac-arm64/GTA 7 Vice Bay.app/Contents/MacOS/GTA 7 Vice Bay';
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(exe, [`--remote-debugging-port=${port}`], { stdio: 'ignore' });
let browser;
for (let i = 0; i < 60 && !browser; i++) {
  try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); }
  catch { await new Promise(r => setTimeout(r, 1000)); }
}
if (!browser) { proc.kill(); throw new Error('app did not open a debug port'); }
let win;
for (let i = 0; i < 60 && !win; i++) {
  win = browser.contexts().flatMap(c => c.pages()).find(p => p.url().startsWith('app://'));
  if (!win) await new Promise(r => setTimeout(r, 500));
}
const errors = [];
win.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
win.on('pageerror', e => errors.push(String(e.stack || e)));
await win.waitForFunction(() => window.game && window.game.time > 2, null, { timeout: 120000 });
await win.keyboard.press('Enter');
await win.waitForTimeout(1500);
const state = await win.evaluate(() => ({
  url: location.href,
  time: window.game.time.toFixed(1),
  vehicles: window.game.vehicles?.list?.length,
  drawCalls: window.game.renderer.info.render.calls,
  size: [innerWidth, innerHeight],
}));
const modelsOk = await win.evaluate(async () => (await fetch('/models/car_sedan.glb')).ok);
await win.screenshot({ path: 'tests/screenshots/app-smoke.png' });
await browser.close().catch(() => {});
proc.kill();
console.log(JSON.stringify({ ...state, modelsOk }, null, 2));
if (errors.length || !modelsOk) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('APP OK');
