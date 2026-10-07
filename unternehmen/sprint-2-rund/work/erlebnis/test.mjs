// Erlebnis checks + screenshots. Run from project root: node unternehmen/sprint-2-rund/work/erlebnis/test.mjs
import { build, preview } from 'vite';
import { chromium } from 'playwright';
const OUT = 'unternehmen/sprint-2-rund/work/erlebnis/';
// build a snapshot and serve it (no HMR reloads while other teams edit files)
const outDir = '/private/tmp/claude-501/erlebnis-dist';
await build({ logLevel: 'error', build: { outDir, emptyOutDir: true } });
const server = await preview({ logLevel: 'error', build: { outDir }, preview: { port: 6400 + Math.floor(Math.random() * 400) } });
server.resolvedUrls = server.resolvedUrls;
server.close = () => new Promise(r => server.httpServer.close(r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e.stack || e)));
const ev = (fn, a) => page.evaluate(fn, a);
const wait = async s => { const t0 = await ev(() => window.game.time); await page.waitForFunction(t => window.game.time > t, t0 + s, { timeout: 120000 }); };
const check = (name, ok, info = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' ' + info : '')); if (!ok) errors.push('check failed: ' + name); };

await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 180000 });
await page.keyboard.press('Enter');
await wait(1.5);

// pickups
const n = await ev(() => window.game.pickups.items.length);
check('15 pickups', n === 15, n);
await ev(() => { const g = window.game; g.player.health = 50; g.player.armor = 0; const it = g.pickups.items[0]; g.player.teleport(it.x, it.z - 5); g.player.heading = 0; g.player.cam.snap(0); });
await wait(0.6);
await page.screenshot({ path: OUT + 'screenshot-pickups-crosshair.png' });
await ev(() => { const g = window.game, it = g.pickups.items[0]; g.player.teleport(it.x, it.z); });
await wait(0.5);
const hp = await ev(() => window.game.player.health);
check('health pickup heals', hp > 50, hp);
check('pickup inactive after take', await ev(() => !window.game.pickups.items[0].active));

// every pickup is reachable (not inside a building) and collectable
let reach = 0;
for (let i = 1; i < 15; i++) {
  await ev(i => { const g = window.game, it = g.pickups.items[i]; g.player.health = 50; g.player.armor = 0; g.player.teleport(it.x, it.z); }, i);
  await wait(0.12);
  if (await ev(i => !window.game.pickups.items[i].active, i)) reach++;
}
check('all 14 other pickups collectable', reach === 14, reach);

// crosshair visible on foot with pistol
await ev(() => window.game.player.weapons.select(1));
await wait(0.4);
check('crosshair on', await ev(() => document.querySelector('.vb-cross').classList.contains('on')));
await ev(() => window.game.input.mouse.right = true); await wait(0.3);
check('crosshair aim', await ev(() => document.querySelector('.vb-cross').classList.contains('aim')));
await ev(() => window.game.input.mouse.right = false);
await ev(() => window.game.player.weapons.select(0)); await wait(0.3);
check('crosshair off with fists', await ev(() => !document.querySelector('.vb-cross').classList.contains('on')));
await ev(() => window.game.player.weapons.select(1));
// hit marker
await ev(() => window.game.events.emit('ped:damaged', { ped: { health: 5, alive: true }, amount: 10, source: 'player' }));
await wait(0.05);
check('hitmarker', await ev(() => document.querySelector('.vb-hitmark').classList.contains('show')));
// weapon display with clip/reloading
await ev(() => { const pl = window.game.player; window.__w = pl.weapon; const fake = { id: 'pistol', name: 'Pistol', ammo: 50, clip: 7, clipSize: 12, reloading: true }; Object.defineProperty(pl, 'weapon', { get: () => fake, set: () => {}, configurable: true }); });
await wait(0.3);
const wtxt = await ev(() => document.querySelector('.vb-weapon').textContent);
check('weapon clip/ammo + RELOADING', /\d+ \/ \d+/.test(wtxt) && /RELOADING/.test(wtxt), wtxt);
await ev(() => { const pl = window.game.player; delete pl.weapon; pl.weapon = window.__w; });

// missions: bar shows objective once
await ev(() => window.game.missions.start('delivery'));
await wait(1.5);
const toasts = await ev(() => [...document.querySelectorAll('.vb-msg')].map(e => e.textContent));
const obj = await ev(() => window.game.missions.active.objectiveText);
check('objective not in toasts', !toasts.includes(obj), JSON.stringify(toasts));
check('objective in top bar', await ev(() => document.querySelector('.vb-mission .o').textContent) === obj);
await page.screenshot({ path: OUT + 'screenshot-mission-bar.png' });
// finish delivery through the stages
const stageTp = async key => ev(k => { const g = window.game, s = g.missions.active.data[k]; if (g.player.vehicle) { const v = g.player.vehicle; v.position.x = s.x; v.position.z = s.z; } g.player.teleport(s.x, s.z); }, key);
await stageTp('pick'); await wait(0.4);
check('delivery stage 2', await ev(() => window.game.missions.active?.stage) === 1);
await stageTp('drop1'); await wait(0.4);
check('delivery stage 3 (car)', await ev(() => window.game.missions.active?.stage) === 2);
await ev(() => { const g = window.game, v = g.vehicles.list.find(v => !v.driver && !v.destroyed); g.player.teleport(v.position.x + 2, v.position.z); });
await page.keyboard.press('KeyF'); await wait(0.5);
check('delivery stage 4', await ev(() => window.game.missions.active?.stage) === 3, await ev(() => window.game.missions.active?.stage));
const moneyBefore = await ev(() => window.game.state.money);
await stageTp('drop2'); await wait(0.5);
check('delivery complete', await ev(() => window.game.missions.active === null && window.game.missions.completed.includes('delivery')));
check('money rewarded', await ev(() => window.game.state.money) > moneyBefore);

// chase
await ev(() => { const g = window.game; g.missions.cooldown = 0; g.missions.start('chase'); });
await wait(0.4);
check('chase stage 1 (already in car) -> 2', await ev(() => window.game.missions.active?.stage) === 1);
const tgt = await ev(() => !!window.game.missions.active.data.target);
check('chase target spawned', tgt);
await ev(() => { const g = window.game; g.vehicles.damage(g.missions.active.data.target, 1000); });
await wait(0.5);
check('chase complete on destroy', await ev(() => window.game.missions.completed.includes('chase')));

// save / load
check('autosave written', await ev(() => window.game.save.save()) && await ev(() => !!localStorage.getItem('gta7.save')));
const saved = await ev(() => JSON.parse(localStorage.getItem('gta7.save')));
check('save content', saved.v === 1 && saved.completed.includes('chase') && typeof saved.money === 'number' && saved.pos, JSON.stringify(saved).slice(0, 160));
await ev(() => { localStorage.setItem('gta7.save', '{"v":1,"money":"x","pos":null,"ammo":5,"completed":7'); });
await page.reload(); await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 180000 });
check('broken save does not crash', true);
await ev(() => localStorage.setItem('gta7.save', JSON.stringify({ v: 1, money: 4321, completed: ['hotwheels'], ammo: { pistol: { ammo: 33 } }, time: 21.5, pos: { x: 50, z: 60 } })));
await page.reload(); await page.waitForFunction(() => window.game && window.game.time > 1, null, { timeout: 180000 });
await wait(0.5);
const loaded = await ev(() => { const g = window.game; return { money: g.state.money, tod: Math.floor(g.world.timeOfDay), x: Math.round(g.player.position.x), pistol: g.player.weapons.states[1].ammo, done: g.missions.completed }; });
check('load restores state', loaded.money === 4321 && loaded.x >= 49 && loaded.x <= 52 && loaded.pistol === 33 && loaded.done.includes('hotwheels'), JSON.stringify(loaded));

// pause menu
await page.keyboard.press('Enter'); await wait(0.1);
await ev(() => window.game.hud.setPause(true));
await ev(() => document.querySelector('.vb-btn:nth-of-type(2)') && null);
await page.screenshot({ path: OUT + 'screenshot-pause.png' });
await ev(() => { const i = document.querySelector('.vb-vol input'); i.value = 30; i.dispatchEvent(new Event('input')); });
check('volume slider', await ev(() => window.game.audio.volumes.master) === 0.3);
await ev(() => window.game.hud.setPause(false));

await browser.close(); await server.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('ERLEBNIS OK');
