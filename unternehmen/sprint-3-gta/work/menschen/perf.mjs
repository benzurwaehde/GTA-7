// Draw-call / triangle measurement at the spawn position, with and without the pedestrian group.
// Usage: tools/heavy.sh node unternehmen/sprint-3-gta/work/menschen/perf.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ server: { port: 5700 + Math.floor(Math.random() * 100), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('ERR', e));
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 180000 });
await page.keyboard.press('Enter');
await page.waitForTimeout(4000);
const r = await page.evaluate(async () => {
  const g = window.game, nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const read = async () => { await nextFrame(); return { calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles }; };
  const out = { peds: g.peds.list.length, humans: g.peds.list.filter(p => p.human).length };
  out.withPeds = await read();
  g.peds.group.visible = false; out.withoutPeds = await read(); g.peds.group.visible = true;
  // update cost of the pedestrian system (JS time per update call, 100 calls)
  const t0 = performance.now(); for (let i = 0; i < 100; i++) g.peds.update(1 / 60); out.pedUpdateMs = +((performance.now() - t0) / 100).toFixed(3);
  return out;
});
console.log(JSON.stringify(r));
await browser.close(); await server.close();
