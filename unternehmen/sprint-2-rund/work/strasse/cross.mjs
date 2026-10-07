// T5 strasse checks: node unternehmen/sprint-2-rund/work/strasse/cross.mjs  (run from project root)
import { createServer } from 'vite';
import { chromium } from 'playwright';
const OUT = 'unternehmen/sprint-2-rund/work/strasse/';
const server = await createServer({ server: { port: 6300 + Math.floor(Math.random() * 400) }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
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


res.cross = await ev(async () => {
  const g = window.game, w = g.world, P = g.peds, orig = w.signalAt, out = { hadNative: typeof orig === 'function' };
  const p = P.list.find(p => p.alive && !p.isCop);
  const { nearestNode, nodePos } = await import('/src/npc/sidewalk.js');
  const n = nearestNode(p.position.x, p.position.z), np = nodePos(n);
  // find a pick that is a cross edge
  p.state = 'walk'; p.position.set(np.x, 0, np.z); p.to = n; p.from = null;
  for (let i = 0; i < 60 && !p.waiting; i++) { p.to = n; p.from = null; P._pickNext(p); }
  out.axis = p.waiting;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const x0 = p.position.x, z0 = p.position.z; const moved = () => Math.hypot(p.position.x - x0, p.position.z - z0);
  w.signalAt = () => 'green'; await sleep(2500); out.movedGreen = +moved().toFixed(2); out.waitingGreen = !!p.waiting;
  w.signalAt = () => 'red'; await sleep(3000); out.movedRed = +moved().toFixed(2); out.waitingRed = !!p.waiting;
  // fallback without signalAt: no cars near -> crossing
  w.signalAt = undefined; p.position.set(x0, 0, z0); p.to = n; p.from = null; p.waiting = null;
  for (let i = 0; i < 60 && !p.waiting; i++) { p.to = n; p.from = null; P._pickNext(p); }
  out.fallbackWaitingSet = !!p.waiting; out.fallbackClear = P._crossingClear(p, p.position.x + 10, p.position.z);
  w.signalAt = orig;
  return out;
});
console.log(JSON.stringify(res));
await browser.close(); await server.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('CROSS OK');
