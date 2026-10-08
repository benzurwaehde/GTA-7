// T1 check: boots the game headless, takes close-up / group / ragdoll screenshots into this folder.
// Usage: tools/heavy.sh node unternehmen/sprint-3-gta/work/menschen/t1-shots.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = 'unternehmen/sprint-3-gta/work/menschen';
mkdirSync(OUT, { recursive: true });
const server = await createServer({ server: { port: 5400 + Math.floor(Math.random() * 400), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => errors.push(String(e.stack || e)));
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 180000 });
await page.keyboard.press('Enter');
const wait = async s => { const t0 = await page.evaluate(() => window.game.time); await page.waitForFunction(t => window.game.time > t, t0 + s, { timeout: 120000 }); };
const shot = async n => { await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('shot', n); };
await wait(2);
// test camera system: runs after the camera rig and overrides it
await page.evaluate(() => {
  const g = window.game;
  g.testcam = { on: false, pos: [0, 0, 0], look: [0, 0, 0] };
  g.systems.push({ name: 'testcam', system: { update() { const t = g.testcam; if (t.follow) { const q = window.__victim, rd = q?.ragdoll; const v = rd ? rd.pelvis({ x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; } }) : q.position; t.pos = [v.x + t.off[0], v.y + t.off[1], v.z + t.off[2]]; t.look = [v.x, v.y, v.z]; } if (!t.on) return; g.camera.position.set(...t.pos); g.camera.lookAt(...t.look); } } });
});
const cam = (pos, look) => page.evaluate(([p, l]) => { window.game.testcam.on = true; window.game.testcam.pos = p; window.game.testcam.look = l; }, [pos, look]);
const info = await page.evaluate(() => {
  const g = window.game;
  return { humanPeds: g.peds.list.filter(p => p.human).length, peds: g.peds.list.length, playerHuman: !!g.player.character.human, hand: !!g.player.character.rightHand,
    bones: Object.keys(g.player.character.human?.bones || {}).slice(0, 40) };
});
console.log(JSON.stringify(info));

// 1. player close-up
const pp = await page.evaluate(() => { const p = window.game.player; return [p.position.x, p.position.z, p.heading]; });
await cam([pp[0] + Math.sin(pp[2]) * 2.6 + 0.8, 1.5, pp[1] + Math.cos(pp[2]) * 2.6], [pp[0], 1.0, pp[1]]);
await wait(0.6); await shot('01-spieler-nah');
await page.keyboard.down('KeyW'); await wait(1.0);
await cam([pp[0] + 3.5, 1.3, pp[1] + 2.5], [pp[0], 1.0, pp[1]]);
await shot('01b-spieler-laeuft'); await page.keyboard.up('KeyW');

// 2. group of pedestrians: line up 8 in front of the player
const fwd = await page.evaluate(() => {
  const g = window.game, p = g.player; const hx = Math.sin(p.heading), hz = Math.cos(p.heading);
  const list = g.peds.list.filter(q => q.alive && !q.isCop).slice(0, 8);
  list.forEach((q, i) => { q.position.set(p.position.x + hx * 7 + hz * (i - 4) * 1.4, 0, p.position.z + hz * 7 - hx * (i - 4) * 1.4); q.heading = p.heading + 3.14 + (i % 3 - 1) * 0.5; q.state = 'walk'; q.to = null; });
  return [hx, hz];
});
const p2 = await page.evaluate(() => { const p = window.game.player; return [p.position.x, p.position.z]; });
await cam([p2[0] + fwd[0] * 1.5, 1.8, p2[1] + fwd[1] * 1.5], [p2[0] + fwd[0] * 8, 1.0, p2[1] + fwd[1] * 8]);
await wait(0.4); await shot('02-gruppe');

// 3. ragdoll: shoot a ped in front of the camera
const rd = await page.evaluate(() => {
  const g = window.game, p = g.player; const hx = Math.sin(p.heading), hz = Math.cos(p.heading);
  const q = g.peds.list.find(q => q.alive && !q.isCop);
  q.position.set(p.position.x + hx * 5, 0, p.position.z + hz * 5); q.heading = p.heading + 1.2; q.state = 'walk';
  window.__victim = q;
  return { x: q.position.x, z: q.position.z, hx, hz };
});
await cam([rd.x, 1, rd.z], [rd.x, 1, rd.z]);
await page.evaluate(([a, b]) => { const t = window.game.testcam; t.follow = true; t.off = [-b * 3.5, 1.0, a * 3.5]; }, [rd.hx, rd.hz]);
await wait(0.3);
await page.evaluate(() => { const g = window.game, q = window.__victim, p = g.player; g.peds.damage(q, 100, 'player', { point: { x: q.position.x, y: 1.3, z: q.position.z, } , dir: { x: Math.sin(p.heading), y: 0, z: Math.cos(p.heading) } }); });
await wait(0.15); await shot('03-ragdoll-a');
await wait(0.35); await shot('03-ragdoll-b');
await wait(1.2); await shot('03-ragdoll-c');
await wait(3.0); await shot('03-ragdoll-liegt');
await page.evaluate(([a, b]) => { window.game.testcam.off = [-b * 2.6, 0.9, a * 2.6]; }, [rd.hx, rd.hz]);
await wait(0.3); await shot('03-ragdoll-seite-nah');
await page.evaluate(() => { window.game.testcam.off = [0.4, 2.6, 0.4]; });
await wait(0.3); await shot('03-ragdoll-oben');
// non-lethal hit
await page.evaluate(() => { const g = window.game, p = g.player; const q = g.peds.list.find(q => q.alive && !q.isCop && q.human); q.position.set(p.position.x + Math.sin(p.heading) * 4, 0, p.position.z + Math.cos(p.heading) * 4); window.__hit = q; g.peds.damage(q, 20, 'player', { point: { x: q.position.x, y: 1.3, z: q.position.z }, dir: { x: 1, y: 0, z: 0 } }); });
const hq = await page.evaluate(() => { const q = window.__hit; return [q.position.x, q.position.z]; });
await cam([hq[0] - 1, 1.5, hq[1] + 3], [hq[0], 1.1, hq[1]]);
await wait(0.12); await shot('04-treffer-reaktion');

// 4b. explosion: group of 6 peds around a blast point, camera looks from the side
const ex = await page.evaluate(() => {
  const g = window.game, p = g.player, hx = Math.sin(p.heading), hz = Math.cos(p.heading);
  const cx = p.position.x + hx * 10, cz = p.position.z + hz * 10;
  const list = g.peds.list.filter(q => q.alive && !q.isCop && q.human).slice(0, 6);
  window.__grp = list;
  list.forEach((q, i) => { const a = i * 1.05; q.position.set(cx + Math.cos(a) * (1.5 + i * 0.7), 0, cz + Math.sin(a) * (1.5 + i * 0.7)); q.state = 'walk'; q.to = null; });
  return { cx, cz, hx, hz };
});
await page.evaluate(() => { window.game.testcam.follow = false; });
await cam([ex.cx - ex.hz * 14, 4, ex.cz + ex.hx * 14], [ex.cx, 1.2, ex.cz]);
await wait(0.3);
await page.evaluate(({ cx, cz }) => { const g = window.game; g.events.emit('explosion', { x: cx, y: 0, z: cz, radius: 9, source: 'grenade' });
  for (const q of window.__grp) { const d = Math.hypot(q.position.x - cx, q.position.z - cz); g.peds.damage(q, 160 * (1 - d / 9) + 30, 'player'); } }, ex);
await wait(0.35); await shot('08-explosion-a');
await wait(0.6); await shot('08-explosion-b');
const exr = await page.evaluate(({ cx, cz }) => window.__grp.map(q => [q.alive, +Math.hypot(q.mesh.position.x - cx, q.mesh.position.z - cz).toFixed(1), q.ragdoll ? +q.ragdoll.age.toFixed(1) : null]), ex);
console.log('explosion', JSON.stringify(exr));

// 4c. car impact: ped hit by a car at 15 m/s
const cr = await page.evaluate(() => {
  const g = window.game, p = g.player, hx = Math.sin(p.heading), hz = Math.cos(p.heading);
  const q = g.peds.list.find(q => q.alive && !q.isCop && q.human && !window.__grp.includes(q));
  q.position.set(p.position.x - hx * 8, 0, p.position.z - hz * 8); window.__car = q;
  return { x: q.position.x, z: q.position.z, hx, hz };
});
await cam([cr.x - cr.hz * 6, 1.8, cr.z + cr.hx * 6], [cr.x + cr.hx * 4, 0.8, cr.z + cr.hz * 4]);
await wait(0.3);
await page.evaluate(({ hx, hz }) => { const g = window.game, q = window.__car; g.peds.kill(q, 'vehicle', hx * 11 , 3 + 15 * 0.15, hz * 11); }, cr);
await wait(0.3); await shot('09-autounfall-a');
await wait(0.9); await shot('09-autounfall-b');

// 5. aiming pose + cop (side views)
await page.evaluate(() => { window.game.testcam.follow = false; });
const pa = await page.evaluate(() => { const p = window.game.player; return [p.position.x, p.position.z, p.heading]; });
await page.mouse.move(640, 360); await page.mouse.down({ button: 'right' });
await wait(0.8);
await cam([pa[0] + 2.2, 1.4, pa[1] + 0.8], [pa[0], 1.2, pa[1] + 0.4]);
await wait(0.3); await shot('05-spieler-zielt');
await page.evaluate(() => window.game.player.character.setWeaponStyle?.('rifle'));
await wait(0.6); await shot('05b-spieler-zielt-zweihand');
await cam([pa[0] - 2.2, 1.4, pa[1] + 0.8], [pa[0], 1.2, pa[1] + 0.4]);
await wait(0.3); await shot('05c-spieler-zielt-zweihand-links');
await page.evaluate(() => window.game.player.character.setWeaponStyle?.('pistol'));
await page.mouse.up({ button: 'right' });
await page.evaluate(() => { const g = window.game, p = g.player; window.__cop = g.peds.spawnCop(p.position.x + 3, p.position.z + 3); window.__cop.cmd.vx = 0; });
await page.evaluate(() => { window.__cop.heading = 0; window.__cop.mesh.rotation.y = 0; });
await cam([pa[0] + 3.6, 1.6, pa[1] + 5.2], [pa[0] + 3, 1.3, pa[1] + 3]);
await wait(0.5); await shot('06-polizist');

// 7. fallback: death clip without ragdoll
await page.evaluate(() => { const g = window.game; g.peds.useRagdoll = false; const q = g.peds.list.find(q => q.alive && !q.isCop && q.human); window.__fb = q; q.position.set(g.player.position.x + 3, 0, g.player.position.z + 6); q.heading = 3.14; });
await page.evaluate(() => { const q = window.__fb; window.game.peds.damage(q, 100, 'player', { point: q.position, dir: { x: 0, y: 0, z: 1 } }); });
const fb = await page.evaluate(() => [window.__fb.position.x, window.__fb.position.z]);
await cam([fb[0] + 3.5, 1.2, fb[1] + 0.5], [fb[0], 0.5, fb[1] + 0.5]);
await wait(1.3); await shot('07-fallback-sterbeanimation');
await page.evaluate(() => { window.game.peds.useRagdoll = true; });

// stats
const stats = await page.evaluate(() => {
  const g = window.game; return { drawCalls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles, ragdolls: g.peds.ragdolls.length };
});
console.log(JSON.stringify(stats));
await browser.close(); await server.close();
if (errors.length) { console.log('CONSOLE:\n' + errors.slice(0, 15).join('\n')); }
