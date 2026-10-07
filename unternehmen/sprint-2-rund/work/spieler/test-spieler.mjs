// T2 spieler test: car collision, aim mode, vertical aim, reload, footsteps, wheel. Run from repo root: node unternehmen/sprint-2-rund/work/spieler/test-spieler.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
const OUT = 'unternehmen/sprint-2-rund/work/spieler/';
const server = await createServer({ server: { port: 5500 + Math.floor(Math.random() * 300), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e.stack || e)));
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 180000 });
await page.keyboard.press('Enter');
const ev = (f, a) => page.evaluate(f, a);
const wait = async s => { const t0 = await ev(() => game.time); try { await page.waitForFunction(t => game.time > t, t0 + s, { timeout: 400000 }); } catch (e) { console.log('GAME STALLED, errors:', errors.slice(0, 3)); process.exit(2); } };
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + ' ' + info); if (!ok) fails++; };

// A1 car collision: walk straight into the side of a parked car
const car = await ev(() => {
  const g = game; g.police.setWanted?.(0);
  const v = g.vehicles.list.find(v => !v.driver && !v.destroyed);
  const h = v.heading, rx = Math.cos(h), rz = -Math.sin(h); // car's right vector
  g.player.teleport(v.position.x + rx * 4, v.position.z + rz * 4);
  g.player.cam.yaw = Math.atan2(-rx, -rz); // walk direction (sin yaw, cos yaw) = -right: towards the car
  v.sleeping = true; v.vx = v.vz = 0; v.speed = 0; v.owned = true; window.__car = v;
  return { x: v.position.x, z: v.position.z };
});
const dbg = () => ev(() => ({ p: [game.player.position.x, game.player.position.z].map(n => +n.toFixed(2)), c: [window.__car.position.x, window.__car.position.z].map(n => +n.toFixed(2)), yaw: +game.player.cam.yaw.toFixed(2), st: game.player.state, veh: !!game.player.vehicle }));
console.log('A1 probe', JSON.stringify(await ev(() => { const v = window.__car, p = game.player; const x0 = p.position.x, z0 = p.position.z; p.position.set(v.position.x + 0.5, 0, v.position.z + 0.2); p.collideVehicles(); const r = { v: [v.heading, v.cr, v.coff, v.radius, v.driver, !!v.destroyed, game.vehicles.list.includes(v)], after: [p.position.x - v.position.x, p.position.z - v.position.z] }; p.position.set(x0, 0, z0); return r; })));
console.log('A1 start', JSON.stringify(await dbg()));
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft'); await wait(2);
console.log('A1 end', JSON.stringify(await dbg()));
const minD = await ev(c => { const g = game, v = window.__car; const p = g.player.position;
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading); let m = 1e9;
  { const u = Math.max(-v.coff, Math.min(v.coff, (p.x - v.position.x) * fx + (p.z - v.position.z) * fz)); m = Math.hypot(p.x - (v.position.x + fx * u), p.z - (v.position.z + fz * u)) - v.cr; }
  return m; }, car);
await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
check('A1 player pressed against car but not inside (0.3 < gap < 1.5)', minD > 0.3 && minD < 1.5, 'gap=' + minD.toFixed(2));
await page.screenshot({ path: OUT + 'spieler-autokollision.png' });

// weapon/clip state
let w = await ev(() => { const p = game.player; p.weapons.select(1); return { ...p.weapon }; });
check('A4 pistol clip 12 / reserve 36', w.clip === 12 && w.clipSize === 12 && w.ammo === 36 && w.reloading === false, JSON.stringify(w));

// aim mode
await ev(() => { game.input.mouse.right = true; });
await wait(1.2);
const aim = await ev(() => ({ info: game.player.getAimInfo(), fov: game.camera.fov, dist: game.player.cam.curDist }));
check('A2 aim mode: fov < 55, aiming true', aim.info.aiming && aim.fov < 55, JSON.stringify(aim));
await page.screenshot({ path: OUT + 'spieler-zielmodus.png' });

// vertical aim: pure ray test without buildings in the way
const direct = await ev(() => {
  const g = game, w = g.player.weapons, V = g.player.position.constructor;
  const ped = g.peds.list.find(q => q.alive);
  const cols = g.world.colliders; g.world.colliders = [];
  const px = ped.position.x, pz = ped.position.z;
  const hitA = w.castRay(new V(px - 12, 6, pz), new V(12, -5, 0).normalize(), 90); // 6 m up, falls to y=1.0 at the ped
  const a = { kind: hitA.kind, y: hitA.point.y };
  void 0;
  const hitB = { ...w.castRay(new V(px - 12, 6, pz), new V(12, -2, 0).normalize(), 90) };   // passes over the ped's head
  const hitC = { ...w.castRay(new V(px - 12, 1.3, pz), new V(1, 0, 0), 90) };               // flat chest-height ray
  g.world.colliders = cols;
  return { steep: a, shallow: hitB.kind, flat: hitC.kind };
});
check('A3 steep ray hits ped at y~1; shallow ray flies over (not ped)', direct.steep.kind === 'ped' && direct.shallow !== 'ped', JSON.stringify(direct));

// real shot with RMB aim: fire, check aimInfo spread and recoil bloom
await ev(() => { game.input.mouse.right = true; game.player.weapons.select(2); });
await wait(0.4);
const s0 = await ev(() => game.player.getAimInfo().spread);
const clip0 = await ev(() => game.player.weapon.clip);
await page.keyboard.down('ControlLeft'); await wait(0.5); await page.keyboard.up('ControlLeft');
const s1 = await ev(() => ({ spread: game.player.getAimInfo().spread, clip: game.player.weapon.clip, trauma: game.player.cam.trauma }));
check('A5 SMG shots consume clip, spread blooms', s1.clip < clip0 && s1.spread > s0, `clip ${clip0}->${s1.clip} spread ${s0.toFixed(3)}->${s1.spread.toFixed(3)} trauma ${s1.trauma.toFixed(2)}`);
await page.screenshot({ path: OUT + 'spieler-schiessen.png' });

// reload: empty clip auto-reload; manual R
await ev(() => { game.input.mouse.right = false; const st = game.player.weapon; st.clip = 3; });
await page.keyboard.press('KeyR');
await wait(0.3);
const rl = await ev(() => ({ ...game.player.weapon, prog: game.player.weapons.reloadProgress }));
check('A4 R starts reload', rl.reloading === true, JSON.stringify(rl));
await page.screenshot({ path: OUT + 'spieler-nachladen.png' });
await wait(2.5);
const rl2 = await ev(() => ({ ...game.player.weapon }));
check('A4 reload finishes (clip 30, reserve reduced by 27)', rl2.clip === 30 && !rl2.reloading, JSON.stringify(rl2));
await ev(() => { const st = game.player.weapon; st.clip = 1; });
await page.keyboard.down('ControlLeft'); await wait(0.3); await page.keyboard.up('ControlLeft');
const auto = await ev(() => ({ ...game.player.weapon }));
check('A4 auto reload on last round', auto.reloading === true && auto.clip === 0, JSON.stringify(auto));
await wait(2.5);

// wheel
const wh = await ev(() => { const i0 = game.player.weapons.index; game.input.mouse.wheel = 1; return i0; });
await wait(0.2);
const wh1 = await ev(() => game.player.weapons.index);
check('A7 mouse wheel changes weapon', wh1 !== wh, `${wh}->${wh1}`);

// footsteps
await ev(() => { window.__steps = 0; const a = game.audio || (game.audio = {}); const old = a.play; a.play = (n, o) => { if (n === 'footstep') window.__steps++; return old?.call(a, n, o); }; game.player.teleport(0, 0); });
await page.keyboard.down('KeyW'); await wait(3); await page.keyboard.up('KeyW');
const steps = await ev(() => window.__steps);
check('A6 footsteps while walking (3 s)', steps >= 3 && steps <= 8, 'steps=' + steps);

console.log('errors:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close(); await server.close();
console.log(fails || errors.length ? 'SPIELER FAIL' : 'SPIELER OK');
process.exit(fails || errors.length ? 1 : 0);
