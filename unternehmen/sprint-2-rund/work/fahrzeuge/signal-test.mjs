// Checks that NPC cars stop at a red mock signal and drive on at green. Run via tools/heavy.sh.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ server: { port: 6600 + Math.floor(Math.random() * 300) }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 180000 });
await page.keyboard.press('Enter');
const res = await page.evaluate(async () => {
  const cfg = await import('/src/core/config.js'), g = window.game, R = cfg.ROAD_LINES;
  g.vehicles.manage = () => {}; for (const v of g.vehicles.list.slice()) g.vehicles.remove(v);
  g.peds.list.length = 0;
  let state = 'red'; g.world.signalAt = () => state;
  // car driving +z on the N-S road at x = R[3] (lane offset), start 60 m before intersection R[4]
  const lane = R[3] - 3.5, z0 = R[4] - 60;
  const v = g.vehicles.spawn('sedan', lane, z0, 0, { driver: 'npc', speed: 12 });
  const step = async s => { const t0 = g.time; while (g.time < t0 + s) await new Promise(r => setTimeout(r, 50)); };
  await step(12);
  const stopped = { z: v.position.z, line: R[4], speed: v.speed };
  state = 'green'; await step(6);
  return { stopped, after: { z: v.position.z, speed: v.speed } };
});
console.log(JSON.stringify(res));
const ok = res.stopped.speed < 0.3 && res.stopped.z < res.stopped.line - 7 && res.after.z > res.stopped.z + 10;
await browser.close(); await server.close();
if (errors.length) console.error(errors.join('\n'));
console.log(ok ? 'SIGNAL OK' : 'SIGNAL FAIL'); process.exit(ok ? 0 : 1);
