// Weapon tour: shop menu, buying, weapon wheel, each weapon in hand, bullet holes, scope, grenade.
import { boot, SHOTS } from './lib.mjs';
const { page, errors, shot, waitGame, close } = await boot();
const ev = (fn, a) => page.evaluate(fn, a);
const log = (...a) => console.log(...a);

// open spot: in front of the shop on the road, camera looking at the shop
await ev(() => {
  const g = window.game, s = g.shop, p = g.player;
  const V = s.position.constructor;
  const front = s.sf.root.localToWorld(new V(0, 0, 9));
  p.teleport(front.x, front.z);
  const dx = s.position.x - front.x, dz = s.position.z - front.z;
  p.cam.yaw = Math.atan2(dx, dz); p.cam.pitch = 0.12; p.heading = p.cam.yaw; p.cam.snap(p.cam.yaw);
  g.state.money = 6000; g.events.emit('money:changed', { money: 6000, delta: 0 });
});
await waitGame(0.5);
// 1) walk into the marker -> menu opens by itself
await ev(() => { const g = window.game, s = g.shop; g.player.teleport(s.position.x, s.position.z); });
await waitGame(0.3);
log('menu open after walking into marker:', await ev(() => window.game.shop.isOpen), 'timeScale', await ev(() => window.game.timeScale));
await page.screenshot({ path: SHOTS + '/shop-menu.png' });
// buy with the keyboard: SMG (row 0), Enter; then down x2 Enter = rifle ...
await page.keyboard.press('Enter'); await page.waitForTimeout(150);
await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);   // shotgun
await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);   // rifle
await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);   // sniper (4500 -> not enough)
await page.screenshot({ path: SHOTS + '/shop-menu-after.png' });
log('after buying:', JSON.stringify(await ev(() => ({ money: window.game.state.money, w: window.game.player.weapons.states.map(s => [s.id, s.owned, s.clip, s.ammo]) }))));
await page.keyboard.press('KeyF'); await page.waitForTimeout(200);
log('menu closed:', !(await ev(() => window.game.shop.isOpen)), 'timeScale', await ev(() => window.game.timeScale));

// 2) weapon wheel
await ev(() => { const g = window.game, s = g.shop, p = g.player; const V = s.position.constructor; const f = s.sf.root.localToWorld(new V(0, 0, 9)); p.teleport(f.x, f.z); p.cam.snap(p.cam.yaw); });
await waitGame(0.5);
await page.keyboard.down('Tab'); await page.waitForTimeout(200);
await ev(() => { const w = window.game.weaponWheel; w.stick.x = 70; w.stick.y = 90; });   // towards the lower right: shotgun/rifle sector
await page.waitForTimeout(250);
log('wheel open', await ev(() => ({ open: window.game.weaponWheel.open, hover: window.game.weaponWheel.hover, ts: window.game.timeScale })));
await page.screenshot({ path: SHOTS + '/weapon-wheel.png' });
await page.keyboard.up('Tab'); await page.waitForTimeout(300);
log('after release:', await ev(() => ({ w: window.game.player.weapons.def.id, ts: window.game.timeScale, open: window.game.weaponWheel.open })));

console.log('errors', errors);
await close();
