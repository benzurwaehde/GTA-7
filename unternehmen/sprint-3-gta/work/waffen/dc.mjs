import { boot } from './lib.mjs';
const { page, errors, waitGame, close } = await boot();
const ev = (fn) => page.evaluate(fn);
await ev(() => { const g = window.game, p = g.player, sp = g.world.getSpawnPoint(); for (const q of g.peds.list) q.position.x += 400; p.teleport(sp.x, sp.z); p.cam.yaw = 0; p.cam.snap(0); });
await waitGame(1.0);
const calls = () => ev(() => window.game.renderer.info.render.calls);
console.log('with Sprint-3 weapons:', await calls());
await ev(() => { const g = window.game; g.shop.sf.root.visible = false; g.player.weapons.impacts.mesh.visible = false; g.player.weapons.hold.visible = false; g.weaponWheel.root.style.display = 'none'; });
await waitGame(0.5);
console.log('without shop/decals/models:', await calls());
// shop in view + firing effects
await ev(() => { const g = window.game, s = g.shop, V = s.position.constructor; s.sf.root.visible = true; const f = s.sf.root.localToWorld(new V(0, 0, 9)); g.player.teleport(f.x, f.z); g.player.cam.yaw = Math.atan2(s.position.x - f.x, s.position.z - f.z); g.player.cam.snap(g.player.cam.yaw); });
await waitGame(1.0);
console.log('shop in view (rest hidden):', await calls());
console.log(errors); await close();
