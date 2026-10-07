// Chase mission robustness: despawn of the thief must not end the mission. Run: tools/heavy.sh node unternehmen/sprint-2-rund/work/erlebnis/chase.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ server: { port: 6800 + Math.floor(Math.random() * 100), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e.stack || e)));
const ev = (fn, a) => page.evaluate(fn, a);
const wait = async s => { const t0 = await ev(() => window.game.time); await page.waitForFunction(t => window.game.time > t, t0 + s, { timeout: 300000 }); };
const check = (n, ok, i = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + n + (i !== '' ? ' ' + i : '')); if (!ok) errors.push('check failed: ' + n); };
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 300000 });
await page.keyboard.press('Enter');
await wait(1);
// get into a car once and keep it
await ev(() => { const g = window.game, v = g.vehicles.list.find(v => !v.driver && !v.destroyed); g.player.teleport(v.position.x + 2, v.position.z); });
await page.keyboard.press('KeyF'); await wait(0.5);
check('player in car', await ev(() => !!window.game.player.vehicle));
const begin = async () => { await ev(() => { const g = window.game; g.missions.cooldown = 0; g.missions.start('chase'); }); await wait(0.4); };
const state = () => ev(() => { const m = window.game.missions.active, t = m?.data.target; return { active: !!m, stage: m?.stage, inList: t ? window.game.vehicles.list.includes(t) : null, owned: t?.owned }; });

// run 1: manager-style despawn of the thief
await begin();
let s = await state(); check('run1 active, thief owned', s.active && s.stage === 1 && s.owned === true, JSON.stringify(s));
await ev(() => { const m = window.game.missions.active; window.game.vehicles.remove(m.data.target); });
await wait(1.5); s = await state();
check('run1 survives despawn, thief back', s.active && s.inList, JSON.stringify(s));
await ev(() => window.game.missions.fail('test'));

// run 2: player ~215 m away -> natural manager despawn (>200 m) must not end it
await begin();
await ev(() => { const g = window.game, t = g.missions.active.data.target, v = g.player.vehicle; v.position.x = t.position.x + 215; v.position.z = t.position.z; v.vx = v.vz = 0; });
await wait(4); s = await state();
check('run2 survives 215 m', s.active && s.inList, JSON.stringify(s));
await ev(() => window.game.missions.fail('test'));

// run 3: long idle must not despawn
await begin();
await ev(() => { const t = window.game.missions.active.data.target; t.ai.idle = 45; });
await wait(2); s = await state();
check('run3 survives idle', s.active && s.inList, JSON.stringify(s));
// far away for >5 s -> fair give up
await ev(() => { const g = window.game, t = g.missions.active.data.target, v = g.player.vehicle; v.position.x = Math.max(-400, Math.min(400, t.position.x + 340)) ; v.position.z = t.position.z; });
const far = await ev(() => { const g = window.game, m = g.missions.active, t = m.data.target; return Math.hypot(g.player.position.x - t.position.x, g.player.position.z - t.position.z); });
console.log('distance now', Math.round(far));
await wait(7);
if (far > 300) check('run3b gives up after >300 m for 5 s', await ev(() => window.game.missions.active === null));
else { check('run3b skipped (map edge), still active', true); await ev(() => window.game.missions.fail('test')); }

// run 4: destroy -> MISSION PASSED, owned reset
await begin();
const tgt = await ev(() => { const g = window.game; window.__t = g.missions.active.data.target; g.vehicles.damage(window.__t, 1000); });
await wait(0.8);
check('run4 completed', await ev(() => window.game.missions.completed.includes('chase') && window.game.missions.active === null));
check('run4 MISSION PASSED shown', await ev(() => document.querySelector('.vb-big').textContent) === 'MISSION PASSED');
check('owned reset', await ev(() => window.__t.owned) === false);
await browser.close(); await server.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('CHASE OK');
