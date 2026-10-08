// Close-ups: each weapon in the hand (side view), muzzle flash, bullet holes on the shop wall, grenade blast.
import { boot, SHOTS } from './lib.mjs';
const { page, errors, shot, waitGame, close } = await boot();
const ev = (fn, a) => page.evaluate(fn, a);
const log = (...a) => console.log(...a);

await ev(() => {
  const g = window.game, s = g.shop, p = g.player, w = p.weapons;
  for (const id of ['smg', 'shotgun', 'rifle', 'sniper', 'grenade']) w.give(id);
  const V = s.position.constructor;
  const f = s.sf.root.localToWorld(new V(-2, 0, 6));
  p.teleport(f.x, f.z);
  p.cam.yaw = Math.atan2(s.position.x - f.x, s.position.z - f.z); p.cam.pitch = 0.1; p.heading = p.cam.yaw; p.cam.snap(p.cam.yaw);
  for (const q of g.peds.list) q.position.x += 400;
  g.police.update = () => {}; // keep the street calm
});
await waitGame(0.6);
const sel = id => ev(i => { const w = window.game.player.weapons; w.select(w.states.findIndex(s => s.id === i)); }, id);

// side view of every weapon: camera swung 90 degrees, body facing the shop wall, gun raised (aim pose)
for (const id of []) {
  await sel(id);
  await page.mouse.move(640, 360); await page.mouse.down({ button: 'right' });
  if (id === 'sniper') { await page.mouse.up({ button: 'right' }); await ev(() => { window.game.player.aimT = 30; }); }
  await shot('hold-' + id, 1.0);
  if (id !== 'sniper') await page.mouse.up({ button: 'right' });
}
// muzzle flash per weapon: freeze time right after the shot, take the picture
for (const id of []) {
  await sel(id);
  await ev(() => { const p = window.game.player; p.aimT = 30; p.cam.yaw = p.heading + 1.0; p.cam.pitch = 0.05; p.cam.snap(p.cam.yaw); const w = p.weapons; w.cooldown = 0; });
  await waitGame(0.6);
  await ev(() => { const g = window.game, p = g.player; p.weapons.update(0.01, true, true, p.cam.yaw); g.timeScale = 0.0005; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: SHOTS + '/flash-' + id + '.png' });
  await ev(() => { window.game.timeScale = 1; });
}
// bullet holes on the wall: stand 3 m from the wall, aim at the window / wall, fire the rifle (held)
await sel('rifle');
await ev(() => {
  const g = window.game, s = g.shop, p = g.player, V = s.position.constructor;
  const f = s.sf.root.localToWorld(new V(0.5, 0, 5.4));
  p.teleport(f.x, f.z);
  p.cam.yaw = Math.atan2(s.position.x - f.x, s.position.z - f.z) + 0.25; p.cam.pitch = -0.02; p.heading = p.cam.yaw; p.cam.snap(p.cam.yaw);
});
await page.mouse.move(640, 360);
await page.mouse.down({ button: 'right' });
await waitGame(1.0);
for (let i = 0; i < 9; i++) { await ev(() => { window.game.player.cam.yaw += 0.035; window.game.player.cam.pitch += 0.004 * (Math.random() - 0.3); }); await page.keyboard.down('ControlLeft'); await waitGame(0.2); await page.keyboard.up('ControlLeft'); }
await ev(() => { window.game.player.cam.yaw -= 0.5; });
await shot('bullet-holes', 0.2);
await page.mouse.up({ button: 'right' });
log('impacts', await ev(() => window.game.player.weapons.impacts.age.filter(a => a < 1e8).length), JSON.stringify(await ev(() => window.game.player.weapons.states.find(s => s.id === 'rifle'))));

// grenade blast: throw, freeze the frame when the fireball is young
await sel('grenade');
await ev(() => { const p = window.game.player, s = window.game.shop; p.teleport(s.position.x + 8, s.position.z + 8); p.cam.pitch = 0.5; p.cam.snap(p.cam.yaw); });
await waitGame(0.5);
await page.keyboard.press('ControlLeft');
await page.waitForFunction(() => window.game.player.weapons.grenades.list.some(o => o.active), null, { timeout: 60000 });
await page.waitForFunction(() => !window.game.player.weapons.grenades.list.some(o => o.active), null, { timeout: 120000 });
await waitGame(0.25);
await page.screenshot({ path: SHOTS + '/grenade-blast.png' });
log('hp', await ev(() => window.game.player.health));
console.log('errors', errors);
await close();
