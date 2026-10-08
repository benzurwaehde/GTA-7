// Police helicopter close-ups with a free camera: search light, bullet hits (smoke), crash, wreck.
import { boot } from './lib.mjs';
const { page, errors, waitGame, shot, close } = await boot();
await page.evaluate(() => {
  const g = window.game, p = g.player;
  p.cam.update = () => {};
  g.player.damage = () => {};                       // test only: keep the target alive
  window.__rig = { x: 0, y: 0, z: 0, on: false };
  const step = () => {
    const h = g.police.helicopter;
    if (window.__rig.on && h) {
      const hp = h.position, c = g.camera;
      const dz = h.state === 'wreck' || h.state === 'crash' && hp.y < 12 ? -14 : -16; c.position.set(hp.x + 6, hp.y + 4, hp.z + dz); c.lookAt(hp.x, hp.y + 1, hp.z); c.updateMatrixWorld();
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  g.police.setWanted(5); g.police.heliCd = 0;
});
await waitGame(2);
await page.evaluate(() => {
  const g = window.game, h = g.police.helicopter, p = g.player.position;
  h.position.set(p.x + 8, h._rooftops(p.x + 8, p.z + 16) + 12, p.z + 16); h.vel.set(0, 0, 0); h.orbit = Math.atan2(16, 8);
  window.__rig.on = true;
});
await shot('t3_heli_search', 0.8);
for (let i = 0; i < 3; i++) {
  console.log('hit', await page.evaluate(() => { const h = window.game.police.helicopter; const r = h.hit({ x: h.position.x, y: h.position.y + 1.5, z: h.position.z }, 30); return [r, h.hp]; }));
}
await shot('t3_heli_damaged_smoke', 1.2);
console.log('ray', await page.evaluate(() => { const h = window.game.police.helicopter, o = { x: h.position.x, y: h.position.y + 1.5, z: h.position.z - 25 }; return h.hitRay(o, { x: 0, y: 0, z: 1 }, 100, 60); }));
console.log('hp', await page.evaluate(() => window.game.police.helicopter.hp));
await page.evaluate(() => { const h = window.game.police.helicopter; h.hit({ x: h.position.x, y: h.position.y + 1.5, z: h.position.z }, 500); });
await shot('t3_heli_falling', 0.6);
await shot('t3_heli_explosion', 0.9);
await shot('t3_heli_wreck', 4);
console.log('state', await page.evaluate(() => window.game.police.helicopter?.state));
await waitGame(3);
console.log('errors', errors);
await close();
if (errors.length) process.exit(1);
