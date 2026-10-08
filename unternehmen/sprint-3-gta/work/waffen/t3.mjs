// Weapons in hand, aim camera, bullet holes, scope, grenade, draw calls.
import { boot, SHOTS } from './lib.mjs';
const { page, errors, shot, waitGame, close } = await boot();
const ev = (fn, a) => page.evaluate(fn, a);
const log = (...a) => console.log(...a);

// everything owned, a quiet spot at the shop wall
await ev(() => {
  const g = window.game, s = g.shop, p = g.player, w = p.weapons;
  for (const id of ['smg', 'shotgun', 'rifle', 'sniper', 'grenade']) w.give(id);
  const V = s.position.constructor;
  const f = s.sf.root.localToWorld(new V(1.5, 0, 7));
  p.teleport(f.x, f.z);
  p.cam.yaw = Math.atan2(s.position.x - f.x, s.position.z - f.z); p.cam.pitch = 0.1; p.heading = p.cam.yaw; p.cam.snap(p.cam.yaw);
  // clear peds around so nothing walks into the picture
  for (const q of g.peds.list) q.position.x += 400;
});
await waitGame(0.6);

const sel = async id => { await ev(i => { const w = window.game.player.weapons; w.select(w.states.findIndex(s => s.id === i)); }, id); };
const fire = async n => { for (let i = 0; i < n; i++) { await page.keyboard.press('ControlLeft'); await waitGame(0.12); } };

// 1) pistol in hand, standing (no aim)
await sel('rifle');
await ev(() => { const p = window.game.player; p.cam.yaw += 0.9; p.heading = p.cam.yaw; p.cam.snap(p.cam.yaw); p.aimT = 5; });
await shot('weapon-rifle-hand', 1.0);

// 2) aim mode (RMB) with rifle: figure sits left of the crosshair
await ev(() => { const p = window.game.player; p.cam.yaw -= 0.9; p.heading = p.cam.yaw; p.cam.snap(p.cam.yaw); });
await page.mouse.move(640, 360); await page.mouse.down({ button: 'right' });
await waitGame(1.0);
await fire(6);
await shot('aim-camera-rifle', 0.2);
log('rifle', JSON.stringify(await ev(() => window.game.player.weapons.states.find(s => s.id === 'rifle'))));

// 3) shotgun at the wall -> holes
await page.mouse.up({ button: 'right' });
await sel('shotgun');
await ev(() => { const p = window.game.player; p.cam.snap(p.cam.yaw); });
await waitGame(0.5);
await page.mouse.down({ button: 'right' });
await waitGame(0.8);
await fire(3);
await waitGame(0.3);
await shot('shotgun-holes', 0.1);
log('impacts active', await ev(() => window.game.player.weapons.impacts.age.filter(a => a < 1e8).length));

// 4) sniper scope
await page.mouse.up({ button: 'right' });
await sel('sniper');
await waitGame(0.4);
await page.mouse.down({ button: 'right' });
await waitGame(1.2);
await shot('sniper-scope', 0.3);
log('scope', await ev(() => ({ k: window.game.player.scopeK, fov: window.game.camera.fov, vis: getComputedStyle(document.querySelector('.ws-scope')).visibility })));
await page.mouse.up({ button: 'right' });
await waitGame(0.8);

// 5) grenade: throw at the street, explosion
await sel('grenade');
await ev(() => { const p = window.game.player; p.cam.pitch = 0.35; });
await waitGame(0.6);
await page.keyboard.press('ControlLeft');
await waitGame(0.5);
log('grenades active', await ev(() => window.game.player.weapons.grenades.list.filter(o => o.active).length));
await shot('grenade-air', 0.4);
await waitGame(3.0);
await shot('grenade-boom', 0.0);
log('grenade after', JSON.stringify(await ev(() => ({ active: window.game.player.weapons.grenades.list.filter(o => o.active).length, hp: window.game.player.health, st: window.game.player.weapons.states.find(s => s.id === 'grenade') }))));

// 6) draw calls at a fixed spot (spawn, looking north)
await ev(() => { const g = window.game, p = g.player, sp = g.world.getSpawnPoint(); p.teleport(sp.x, sp.z); p.cam.yaw = 0; p.cam.snap(0); });
await waitGame(1.0);
log('drawcalls', await ev(() => ({ calls: window.game.renderer.info.render.calls, tris: window.game.renderer.info.render.triangles })));
console.log('errors', errors);
await close();
