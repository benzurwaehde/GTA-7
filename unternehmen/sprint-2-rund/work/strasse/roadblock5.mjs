// T5 strasse checks: node unternehmen/sprint-2-rund/work/strasse/roadblock5.mjs  (run from project root)
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


const runs = [
  { name: 'A', x: -148, z: -120, yaw: 0 },
  { name: 'B', x: 148, z: -120, yaw: 0 },
  { name: 'C', x: 0, z: 5, yaw: Math.PI / 2 },
  { name: 'D', x: 60, z: 200, yaw: Math.PI },
  { name: 'E', x: 200, z: -60, yaw: 0 },
  { name: 'F stub: first spawn fails', x: -148, z: -120, yaw: 0, stub: true },
  { name: 'G noCars forced true', x: 148, z: -120, yaw: 0, nocars: true },
];
let okCount = 0;
await ev(() => { const g = window.game; window.__evlog = []; for (const n of ['player:died', 'player:respawn', 'player:busted', 'wanted:changed']) g.events.on(n, e => window.__evlog.push(n + (e?.level !== undefined ? '=' + e.level : '') + '@' + g.time.toFixed(1))); });
for (const r of runs) {
  await ev(r => { const g = window.game; g.police.setWanted(0); g.police.reset(); g.police.blockT = 0.5; g.police.blockTry = 0; g.police.blockDbg = '';
    g.player.heal(100); g.player.teleport?.(r.x, r.z); g.player.heading = r.yaw; g.player.cam.snap(r.yaw);
    if (r.stub) { const v = g.vehicles, o = v.spawn.bind(v); let n = 0; window.__origSpawn = v.spawn; v.spawn = (...a) => (a[0] === 'police' && n++ === 0 ? null : o(...a)); }
    if (r.nocars) { g.police.noCars = true; g.police.noCarsT = 1e9; } }, r);
  await wait(0.5);
  const t0 = await ev(() => { const g = window.game; g.police.setWanted(4); return g.time; });
  let found = null;
  for (let i = 0; i < 40 && !found; i++) {
    await wait(0.5);
    found = await ev(() => { const g = window.game, B = g.police.block; g.player.heal(100); return B ? { t: g.time, cars: B.cars.map(c => [+c.vehicle.position.x.toFixed(1), +c.vehicle.position.z.toFixed(1)]), flags: B.cars.map(c => !!c.block) } : null; });
    const t = await ev(() => window.game.time); if (t - t0 > 10) break;
  }
  const dbg = await ev(() => { const g = window.game; if (window.__origSpawn) { g.vehicles.spawn = window.__origSpawn; window.__origSpawn = null; } g.police.noCarsT = 0; return window.__evlog.splice(0).join(',') + ' | ' + g.police.blockDbg + ' [alive=' + g.player.alive + ' wanted=' + g.police.wanted + ' noCars=' + g.police.noCars + ' blockT=' + g.police.blockT.toFixed(1) + ' cars=' + g.police.cars.length + ' blockObj=' + !!g.police.block + ' pos=' + (g.player.position.x | 0) + ',' + (g.player.position.z | 0) + ']'; });
  const pass = !!found && found.t - t0 <= 10 && found.cars.length === 2 && found.flags.every(Boolean);
  if (pass) okCount++;
  console.log(`${r.name} start=(${r.x},${r.z}) yaw=${r.yaw.toFixed(2)} -> ${found ? 'block after ' + (found.t - t0).toFixed(1) + 's cars ' + JSON.stringify(found.cars) : 'NO BLOCK'} lastDbg=${dbg} ${pass ? 'ok' : 'FAIL'}`);
}
await browser.close(); await server.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log(okCount === runs.length ? `ROADBLOCK ${okCount}/${runs.length} OK` : `ROADBLOCK FAIL ${okCount}/${runs.length}`);
