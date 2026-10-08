// Shared helper for the weapons test scripts: starts Vite (no HMR / file watching, the other team edits files in parallel)
// and a headless Chromium page with the game running.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
export const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots');

export async function boot() {
  const server = await createServer({
    root: ROOT, logLevel: 'error',
    server: { port: 6700 + Math.floor(Math.random() * 500), strictPort: false, hmr: false, watch: null },
  });
  await server.listen();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e.stack || e)));
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 180000 });
  await page.keyboard.press('Enter'); // dismiss the title screen
  const waitGame = async sec => {
    const t0 = await page.evaluate(() => window.game.time);
    await page.waitForFunction(t => window.game.time > t, t0 + sec, { timeout: 120000 });
  };
  const shot = async (name, sec = 0.5) => { await waitGame(sec); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); console.log('shot', name); };
  const close = async () => { await browser.close(); await server.close(); };
  return { page, errors, waitGame, shot, close };
}
