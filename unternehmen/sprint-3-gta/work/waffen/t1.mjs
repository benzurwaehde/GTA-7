import { boot } from './lib.mjs';
const { page, errors, shot, waitGame, close } = await boot();
const info = await page.evaluate(() => {
  const g = window.game, s = g.shop;
  return { placed: s.placed, pos: s.position.toArray(), states: g.player.weapons.states.map(x => [x.id, x.owned, x.clip, x.ammo]), models: Object.keys(g.player.weapons.models), hold: !!g.player.weapons.hold.parent };
});
console.log(JSON.stringify(info));
// put the player in front of the shop, looking at it
await page.evaluate(() => {
  const g = window.game, s = g.shop, p = g.player;
  const front = s.sf.root.localToWorld(new (s.position.constructor)(0, 0, 9));
  p.teleport(front.x, front.z);
  const dx = s.position.x - front.x, dz = s.position.z - front.z;
  p.cam.yaw = Math.atan2(dx, dz); p.cam.pitch = 0.12; p.heading = p.cam.yaw; p.cam.ready = false;
});
await shot('shop-front', 1.5);
console.log('errors', errors);
await close();
