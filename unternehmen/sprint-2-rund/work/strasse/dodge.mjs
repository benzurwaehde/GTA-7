// T5 strasse checks: node unternehmen/sprint-2-rund/work/strasse/dodge.mjs  (run from project root)
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


const LANE_X = -3.5;
const scenarios = [
  { name: 'NPC slow (5 m/s)', npc: 'slow' },
  { name: 'NPC stationary', npc: 'stop' },
  { name: 'control (no NPC)', npc: null },
];
let allOk = true;
for (const sc of scenarios) {
  const { rows, minDx } = await ev(async sc => {
    const LANE_X = -3.5;
    const g = window.game, P = g.police, V = g.vehicles;
    P.setWanted(0); P.reset();
    g.player.heal(100); g.player.teleport?.(0, 70);
    P.setWanted(2); P.footTimer = 1e9; P.carTimer = 1e9;
    for (const v of V.list.slice()) if (!v.destroyed && Math.hypot(v.position.x, v.position.z + 90) < 130 && v.driver !== 'player') V.remove?.(v);
    const cop = V.spawn('police', LANE_X, -135, 0, { driver: 'police' });
    cop.driver = 'police'; cop.sirenOn = true;
    const entry = { vehicle: cop, state: 'chase', stuckT: 0, reverseT: 0, revSteer: 1, path: null, pathT: 0, lastHeading: 0, lastRaw: 0, totalStuck: 0, age: 0, leaveT: 0 };
    P.cars.push(entry);
    let npc = null;
    if (sc.npc) {
      npc = V.spawn('sedan', LANE_X, -85, 0, { driver: 'dummy' });
      const orig = V.update.bind(V);
      V.update = (dt, ...r) => {
        if (npc && !npc.destroyed) {
          const sp = npc.speed || 0, want = sc.npc === 'slow' ? 5 : 0;
          const err = Math.atan2(LANE_X - npc.position.x, 15) - npc.heading;
          npc.setControls({ throttle: sp < want ? 0.5 : 0, steer: -Math.max(-1, Math.min(1, err * 1.6)), brake: sc.npc === 'stop' ? 1 : (sp > want + 1 ? 0.5 : 0), handbrake: sc.npc === 'stop' });
        }
        return orig(dt, ...r);
      };
      window.__restore = () => { V.update = orig; };
    }
    const out = [], t0 = g.time;
    let next = 0, hitFlag = false, minDx = 99;
    g.events.on('vehicle:crash', () => { hitFlag = true; });
    while (g.time - t0 < 14) {
      await new Promise(r => setTimeout(r, 60));
      g.player.heal(100);
      if (cop.driver !== 'police') break;
      if (npc && Math.abs(cop.position.z - npc.position.z) < 4.6) minDx = Math.min(minDx, Math.abs(cop.position.x - npc.position.x));
      if (g.time - t0 >= next) {
        next += 0.5;
        const gap = npc ? Math.hypot(cop.position.x - npc.position.x, cop.position.z - npc.position.z) : -1;
        out.push({ t: +(g.time - t0).toFixed(1), gap: +gap.toFixed(1), off: +(cop.position.x - LANE_X).toFixed(2), sp: +cop.speed.toFixed(1), cz: +cop.position.z.toFixed(0), nz: npc ? +npc.position.z.toFixed(0) : 0, crash: hitFlag });
      }
    }
    window.__restore?.(); window.__restore = null;
    if (npc) V.remove?.(npc);
    V.remove?.(cop); P.reset();
    return { rows: out, minDx };
  }, sc);
  console.log('--- ' + sc.name + '  (t s | gap m | lateral offset m | speed m/s | police z | npc z)');
  for (const r of rows) console.log(`${String(r.t).padStart(5)} ${String(r.gap).padStart(7)} ${String(r.off).padStart(6)} ${String(r.sp).padStart(6)} ${String(r.cz).padStart(6)} ${String(r.nz).padStart(6)}`);
  const v0 = Math.max(...rows.slice(0, 6).map(r => r.sp));
  const near = rows.filter(r => r.gap >= 0 && r.gap < 15);
  const minGap = sc.npc ? Math.min(...rows.map(r => r.gap)) : null;
  const passRows = rows.filter(r => sc.npc && Math.abs(r.cz - r.nz) < 12);
  const maxOff = Math.max(0, ...passRows.map(r => Math.abs(r.off)));
  const minNear = near.length ? Math.min(...near.map(r => r.sp)) : null;
  const noHit = !sc.npc || (minDx > 2.0 && !rows.some(r => r.crash));   // body boxes: ~2 m wide, ~4.4 m long
  const dodged = !sc.npc || maxOff > 1.5 || (minNear !== null && minNear < 0.6 * v0);
  const maxOffAll = Math.max(...rows.map(r => Math.abs(r.off)));
  console.log(`v0=${v0} minGap(centers)=${minGap} minLateralWhenAlongside=${minDx} maxOffsetWhilePassing=${maxOff.toFixed(2)} minSpeedUnder15m=${minNear} maxOffsetOverall=${maxOffAll.toFixed(2)} -> ${sc.npc ? (noHit && dodged ? 'ok' : 'FAIL') : 'control'}`);
  if (sc.npc && !(noHit && dodged)) allOk = false;
}
await browser.close(); await server.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log(allOk ? 'DODGE OK' : 'DODGE FAIL');
