// T5 strasse checks: node unternehmen/sprint-2-rund/work/strasse/test.mjs  (run from project root)
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

// 1. ped close-up: line peds up in front of the camera
await ev(() => { const g = window.game; g.player.cam && (g.player.cam.distance = 4);
  const p = g.peds.list.find(p => p.alive && !p.isCop); g.player.teleport?.(p.position.x + 3, p.position.z + 3); g.player.cam.snap(0); });
await wait(1);
await ev(() => { const g = window.game, pp = g.player.position; const ps = g.peds.list.filter(p => p.alive && !p.isCop);
  ps.slice(0, 9).forEach((p, i) => { p.position.set(pp.x - 4.4 + i * 1.1, 0, pp.z + 4.5 + (i % 3) * 1.6); p.heading = Math.PI + 0.25 * (i % 3 - 1); p.speed = 0.01; p.state = 'walk'; p.waiting = 'ns'; p.waitT = 0; }); });
await wait(0.4);
await shot('01-peds');
await ev(() => { const g = window.game; g.peds.list.forEach(p => { p.waiting = null; p.speed = 1.3; }); });
res.pedMeshes = await ev(() => ({ perPed: window.game.peds.list[0].mesh.children.length, geoms: window.game.renderer.info.memory.geometries }));

// 2. crossing logic with signal stub
res.cross = await ev(async () => {
  const g = window.game, w = g.world; const orig = w.signalAt; const out = {};
  const cnt = () => g.peds.list.filter(p => p.waiting).length;
  const mk = (s) => { w.signalAt = () => s; };
  mk('green'); await new Promise(r => setTimeout(r, 12000)); out.waitingGreen = cnt();
  mk('red'); await new Promise(r => setTimeout(r, 6000)); out.waitingRed = cnt();
  w.signalAt = orig; out.hadNative = typeof orig === 'function';
  return out;
});
await wait(0.2);

// 3. fighters hit back
res.fight = await ev(async () => {
  const g = window.game; g.police.setWanted(0);
  g.player.heal?.(100);
  const p = g.peds.list.find(p => p.alive && !p.isCop); p.fighter = true;
  g.player.weapons.select(0); g.player.teleport?.(p.position.x + 1, p.position.z);
  const h0 = g.player.health;
  g.peds.damage(p, 5, 'player');
  const st = p.state;
  await new Promise(r => setTimeout(r, 6000));
  return { state: st, healthBefore: h0, healthAfter: g.player.health, nowState: p.state };
});

// 4. roadblock
await ev(() => { const g = window.game; g.peds.list.filter(p => p.state === 'fight').forEach(p => p.fightT = 0); g.player.teleport?.(0, 5); g.player.cam.snap(Math.PI / 2); g.player.heading = Math.PI / 2; g.police.setWanted(4); });
await wait(8);
console.log(JSON.stringify(await ev(() => { const g = window.game; return { wanted: g.police.wanted, noCars: g.police.noCars, blockT: g.police.blockT, cars: g.police.cars.length, hasSpawn: !!g.vehicles.spawn, pos: [g.player.position.x, g.player.position.z], h: g.player.heading }; })));
await page.waitForFunction(() => window.game.police.block, null, { timeout: 30000 });
res.block = await ev(() => { const g = window.game, B = g.police.block; return { cars: B.cars.map(c => [c.vehicle.position.x | 0, c.vehicle.position.z | 0, +c.vehicle.heading.toFixed(2)]), player: [g.player.position.x | 0, g.player.position.z | 0] }; });
// look at roadblock: stand 18 m before it
await ev(() => { const g = window.game, B = g.police.block, v = B.cars[0].vehicle, f = B.fx, fz = B.fz; g.player.teleport?.(v.position.x - f * 22 - fz * 0, v.position.z - fz * 22); g.player.heal(100); g.player.heading = Math.atan2(f, fz); g.player.cam.snap(Math.atan2(f, fz)); g.player.cam.distance = 6; });
await wait(1.5);
await shot('02-roadblock');

// 5. police lane + avoidance: log lateral offset of far chasing cars
await ev(() => { const g = window.game; g.police.setWanted(2); g.player.heal(100); g.player.teleport?.(-250, -250); });
await wait(14);
res.policeLane = await ev(() => { const g = window.game; return g.police.cars.filter(c => !c.block).map(c => { const v = c.vehicle; return { x: +v.position.x.toFixed(1), z: +v.position.z.toFixed(1), h: +v.heading.toFixed(2), sp: +v.speed.toFixed(1), d: +Math.hypot(v.position.x - g.player.position.x, v.position.z - g.player.position.z).toFixed(0) }; }); });

// 6. audio
res.audio = await ev(async () => {
  const a = window.game.audio; a.unlock(); await new Promise(r => setTimeout(r, 500));
  const o = { ready: a.ready, state: a.ctx?.state };
  for (const n of ['footstep', 'reload', 'empty']) { try { a.play(n, { x: 0, z: 0 }); o[n] = 'ok'; } catch (e) { o[n] = String(e); } }
  a.hornStart(); o.hornOn = !!a.horn; await new Promise(r => setTimeout(r, 300)); a.hornStop(); o.hornOff = !a.horn;
  await new Promise(r => setTimeout(r, 300));
  o.humVoices = a.hum?.length;
  return o;
});
res.draw = await ev(() => window.game.renderer.info.render.calls);
console.log(JSON.stringify(res, null, 1));
await browser.close(); await server.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('T5 OK');
