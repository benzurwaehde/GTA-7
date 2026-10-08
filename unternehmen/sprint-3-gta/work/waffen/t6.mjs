// Helicopter hit via the real shoot() path, sea limit.
import { boot } from './lib.mjs';
const { page, errors, waitGame, close } = await boot();
const ev = (fn, a) => page.evaluate(fn, a);
await ev(() => { window.game.player.teleport(8.5, 20); window.game.police.setWanted(5); });
let heli = null;
for (let i = 0; i < 40 && !heli; i++) { await waitGame(3); heli = await ev(() => !!window.game.police.helicopter); }
console.log('heli present', heli);
console.log(JSON.stringify(await ev(() => {
  const g = window.game, p = g.player, w = p.weapons, h = g.police.helicopter, c = p.cam;
  w.give('sniper'); w.select(w.states.findIndex(x => x.id === 'sniper'));
  const out = []; p.position.set(h.position.x - 22, 0, h.position.z);
  for (let i = 0; i < 3; i++) {
    c.aimOrigin.set(p.position.x, 1.5, p.position.z);
    c.aimDir.copy(h.position).sub(c.aimOrigin).normalize();
    p.aimK = 1; p.scopeK = 1; w.cooldown = 0; w.current.clip = 5; w.current.reloading = false;
    const hp0 = h.hp; w.shoot(w.def); out.push([hp0, h.hp, h.dead, w.castRay(c.aimOrigin, c.aimDir, 300).kind]);
  }
  return out;
})));
// sea limit: walk off the beach beside the pier
await ev(() => { const p = window.game.player; p.teleport(-60, 325); p.cam.yaw = 0; p.heading = 0; p.cam.snap(0); });
await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await waitGame(3); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
console.log('beach:', JSON.stringify(await ev(() => { const p = window.game.player, w = window.game.world; return [p.position.x.toFixed(1), p.position.y.toFixed(2), p.position.z.toFixed(1), w.playLimit, w.groundAt(p.position.x, p.position.z)]; })));
console.log(errors.filter(e => !/pointer lock/.test(e)));
await close();
