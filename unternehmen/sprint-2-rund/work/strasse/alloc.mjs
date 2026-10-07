// T5 strasse checks: node unternehmen/sprint-2-rund/work/strasse/alloc.mjs  (run from project root)
import { createServer } from 'vite';
import { chromium } from 'playwright';
const OUT = 'unternehmen/sprint-2-rund/work/strasse/';
const server = await createServer({ server: { port: 6300 + Math.floor(Math.random() * 400) }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e.stack || e)));
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 240000 });
await page.keyboard.press('Enter');
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = async s => { const t0 = await ev(() => window.game.time); await page.waitForFunction(t => window.game.time > t, t0 + s, { timeout: 240000 }); };
const shot = async n => { await page.screenshot({ path: OUT + n + '.png' }); console.log('shot', n); };
const res = {};
process.on('exit', () => console.log('PARTIAL', JSON.stringify(res)));


const r = await ev(async () => {
  const g = window.game, P = g.police;
  g.player.heal(100); g.player.teleport?.(0, 5); P.setWanted(4);
  await new Promise(r => setTimeout(r, 15000));   // let cops, cars and the roadblock spawn
  const info = { cops: P.cops.length, cars: P.cars.length, block: !!P.block };
  const pp = g.player.position, per = {};
  const meas = (name, fn) => { fn(); window.gc?.(); const h0 = performance.memory.usedJSHeapSize; for (let i = 0; i < 600; i++) fn(); per[name] = Math.round((performance.memory.usedJSHeapSize - h0) / 1024); };
  meas('update', () => P.update(1 / 60));
  meas('updateCars', () => { for (const c of P.cars) P._updateCar(c, 1 / 60, pp); });
  meas('updateCops', () => { for (const c of P.cops) P._updateCop(c, 1 / 60, pp); });
  meas('roadblock', () => P._roadblock(1 / 60, pp));
  meas('spawnLogic', () => P._spawnLogic(1 / 60, pp));
  meas('evasion', () => P._evasion(1 / 60, pp));
  meas('watch', () => P._watchPoliceCars());
  meas('tracers', () => P._updateTracers(1 / 60));
  const h0 = 0, h1 = 0;
  return { ...info, perFunctionGrowthKB_600frames: per, gc: typeof window.gc };
});
console.log('600 police.update frames at wanted 4 (no GC in between):', JSON.stringify(r));
await browser.close(); await server.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('ALLOC DONE');
