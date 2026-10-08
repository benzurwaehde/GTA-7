// Round 2 checks: New Game, grenade vs wall, helicopter, pier, rifle in hand, wheel/pause, restore fallback.
import { boot, SHOTS } from './lib.mjs';
const { page, errors, shot, waitGame, close } = await boot();
const ev = (fn, a) => page.evaluate(fn, a);
const log = (...a) => console.log(...a);

// --- 3) broken ammo data -> starting ammo
log('restore fallback:', JSON.stringify(await ev(() => {
  const g = window.game;
  localStorage.setItem('gta7.arms', '{"v":1,"owned":["sniper"],"ammo":{"sniper":{"ammo":"x"}}}');
  g.shop.restore();
  const s = g.player.weapons.stateOf('sniper'); const r = [s.owned, s.clip, s.ammo];
  s.owned = false; s.clip = 0; s.ammo = 0; localStorage.removeItem('gta7.arms'); return r;
})));

// --- 2) grenade vs wall (open street in front of the shop; blast on one side of a thin wall, ped + player on the other)
const res = await ev(() => {
  const g = window.game, p = g.player, gr = p.weapons.grenades, s = g.shop, V = s.position.constructor;
  const f = s.sf.root.localToWorld(new V(0, 0, 9)); // road in front of the shop
  const ped = g.peds.list.find(q => q.alive);
  const test = withWall => {
    const ox = f.x, oz = f.z;
    ped.alive = true; ped.health = 100; ped.state = 'walk'; ped.position.set(ox + 5, 0, oz);
    p.position.set(ox + 6, 0, oz + 1); p.health = 100; p.armor = 0;
    const wall = { minX: ox + 2.8, maxX: ox + 3.2, minZ: oz - 8, maxZ: oz + 8, maxY: 6, type: 'building' };
    if (withWall) g.world.colliders.push(wall);
    const o = gr.list[0]; o.mesh.position.set(ox, 0.3, oz); o.active = true;
    gr.explode(o);
    const out = { pedHp: Math.round(ped.health), playerHurt: Math.round(100 - p.health) };
    if (withWall) g.world.colliders.pop();
    return out;
  };
  return { open: test(false), wall: test(true) };
});
log('grenade open vs wall:', JSON.stringify(res));
await ev(() => { const p = window.game.player; p.health = 100; p.alive = true; });

// --- 1) New Game (reload): sniper owned before, gone after
await ev(() => { const g = window.game; g.player.weapons.give('sniper'); g.shop.persist(); });
log('arms before:', await ev(() => localStorage.getItem('gta7.arms')?.slice(0, 60)));
await Promise.all([page.waitForNavigation({ timeout: 120000 }), ev(() => window.game.save.newGame())]);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 180000 });
log('arms after New Game:', await ev(() => localStorage.getItem('gta7.arms')), 'sniper owned:', await ev(() => window.game.player.weapons.stateOf('sniper').owned));
await page.keyboard.press('Enter');

// --- 5/6) wheel closes on Escape/pause
await ev(() => { window.game.player.teleport(8.5, 20); });
await page.keyboard.down('Tab'); await page.waitForTimeout(500);
log('wheel open:', await ev(() => [window.game.weaponWheel.open, window.game.timeScale]));
await page.keyboard.press('Escape'); await page.waitForTimeout(500);
log('after Escape:', await ev(() => [window.game.weaponWheel.open, window.game.timeScale, window.game.paused]));
await page.keyboard.up('Tab');
await ev(() => { const h = document.querySelector('.vb-btn'); }); 
await page.keyboard.press('Escape'); await page.waitForTimeout(300); // unpause

// --- 4) rifle in hand
await ev(() => {
  const g = window.game, s = g.shop, p = g.player, w = p.weapons, V = s.position.constructor;
  w.give('rifle'); w.select(w.states.findIndex(x => x.id === 'rifle'));
  const f = s.sf.root.localToWorld(new V(1.5, 0, 7)); p.teleport(f.x, f.z);
  p.cam.yaw = Math.atan2(s.position.x - f.x, s.position.z - f.z) + 0.9; p.heading = p.cam.yaw; p.cam.snap(p.cam.yaw);
  for (const q of g.peds.list) q.position.x += 400;
});
await page.mouse.move(640, 360); await page.mouse.down({ button: 'right' });
await shot('hold-rifle', 1.2);
await page.mouse.up({ button: 'right' });
log('hold parent:', await ev(() => window.game.player.weapons.hold.parent?.name));

// --- 8) pier (x=0, from z = half+8 southwards, 8 m wide)
const H = await ev(() => window.game.world.playLimit);
log('playLimit', H);
await ev(() => { const g = window.game, p = g.player; p.teleport(0, 380); p.cam.yaw = 0; p.heading = 0; p.cam.snap(0); });
await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await waitGame(5); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
const st = () => ev(() => { const p = window.game.player, w = window.game.world; return { x: +p.position.x.toFixed(1), y: +p.position.y.toFixed(2), z: +p.position.z.toFixed(1), walkable: w.isWalkable(p.position.x, p.position.z), ground: w.groundAt(p.position.x, p.position.z) }; });
log('walked down the pier:', JSON.stringify(await st()));
await shot('pier-walk', 0.3);
await ev(() => { window.game.player.cam.yaw += Math.PI / 2; });
await page.keyboard.down('KeyW'); await waitGame(2.5); await page.keyboard.up('KeyW');
log('pushing sideways into the water:', JSON.stringify(await st()));
// beach: walk straight south beside the pier root until the limit
await ev(() => { const p = window.game.player; p.teleport(40, 326); p.cam.yaw = 0; p.cam.snap(0); });
await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await waitGame(3); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
log('beach end:', JSON.stringify(await st()));
await shot('beach-limit', 0.3);

// --- 7) helicopter
await ev(() => { const g = window.game; g.player.teleport(8.5, 20); g.police.setWanted(5); });
let heli = null;
for (let i = 0; i < 40 && !heli; i++) { await waitGame(3); heli = await ev(() => { const h = window.game.police.helicopter; return h ? { hp: h.hp, pos: h.position.toArray?.() ?? h.position } : null; }); }
log('helicopter:', JSON.stringify(heli));
if (heli) {
  const r = await ev(() => {
    const g = window.game, p = g.player, w = p.weapons, h = g.police.helicopter;
    w.give('sniper'); w.select(w.states.findIndex(x => x.id === 'sniper'));
    // put the player 25 m from the heli, aim at it
    const hp = h.position; p.teleport(hp.x - 25, hp.z); p.position.y = 0;
    const dx = hp.x - p.position.x, dy = hp.y - (p.position.y + 1.5), dz = hp.z - p.position.z;
    p.cam.yaw = Math.atan2(dx, dz); p.cam.pitch = -Math.atan2(dy, Math.hypot(dx, dz)); p.cam.snap?.(p.cam.yaw); p.cam.pitch = -Math.atan2(dy, Math.hypot(dx, dz));
    return { hp0: h.hp };
  });
  await page.mouse.move(640, 360); await page.mouse.down({ button: 'right' }); await waitGame(1.0);
  const hpBefore = await ev(() => window.game.police.helicopter?.hp);
  await ev(() => { const g = window.game, p = g.player, h = g.police.helicopter; const dx = h.position.x - p.position.x, dy = h.position.y - (p.position.y + 1.5), dz = h.position.z - p.position.z; p.cam.yaw = Math.atan2(dx, dz); p.cam.pitch = -Math.atan2(dy, Math.hypot(dx, dz)); });
  await waitGame(0.2);
  await ev(() => { const g = window.game; g.player.weapons.cooldown = 0; g.player.weapons.update(0.01, true, true, g.player.cam.yaw); });
  log('rayHit', await ev(() => { const g = window.game, p = g.player, h = g.police.helicopter, d = g.player.cam.aimDir, o = g.player.cam.aimOrigin; return [h.rayHit(o, d, 400), h.position.toArray?.(), o.toArray(), d.toArray(), g.player.weapons.castRay(o, d, 400).kind]; }));
  await waitGame(0.3);
  log('heli hp (sniper shot):', hpBefore, '->', await ev(() => window.game.police.helicopter?.hp), JSON.stringify(r));
  await page.mouse.up({ button: 'right' });
  // grenade blast directly under it
  const hb = await ev(() => window.game.police.helicopter?.hp);
  await ev(() => { const g = window.game, h = g.police.helicopter, gr = g.player.weapons.grenades, o = gr.list[1]; o.mesh.position.set(h.position.x, Math.max(0.3, h.position.y - 2), h.position.z); o.active = true; gr.explode(o); });
  log('heli hp (grenade):', hb, '->', await ev(() => window.game.police.helicopter?.hp));
}
console.log('errors', errors.filter(e => !/pointer lock/.test(e)));
await close();
