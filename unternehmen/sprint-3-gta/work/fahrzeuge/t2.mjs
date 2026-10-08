// Motorcycle (lean, rider), police helicopter (spawn, search light, shot down) and traffic yielding to a siren.
import { boot } from './lib.mjs';
const { page, errors, waitGame, shot, close } = await boot();
const hold = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };

// ---- siren: an NPC car with a police car coming up behind it ----
const yieldRes = await page.evaluate(async () => {
  const g = window.game, vm = g.vehicles;
  const npc = vm.list.find(v => v.driver === 'npc' && !v.destroyed && Math.abs(v.speed) > 3);
  if (!npc) return 'no npc car';
  const h = npc.heading, fx = Math.sin(h), fz = Math.cos(h);
  const cop = vm.spawn('police', npc.position.x - fx * 38, npc.position.z - fz * 38, h, { driver: 'police', speed: 22 });
  cop.sirenOn = true; cop.isCop = true;
  g.player.position.set(npc.position.x + 10, 0, npc.position.z);
  const log = [];
  const t0 = g.time;
  window.__sirenCop = cop; window.__sirenNpc = npc;
  return { npcSpeed: npc.speed, copSpeed: cop.speed };
});
console.log('siren setup', yieldRes);
for (let i = 0; i < 6; i++) {
  await waitGame(1.2);
  console.log(await page.evaluate(() => {
    const c = window.__sirenCop, n = window.__sirenNpc;
    c.setControls({ throttle: 0.6, steer: 0 });
    return { t: window.game.time.toFixed(1), npcSpeed: n.speed.toFixed(1), yieldT: n.ai?.yieldT?.toFixed?.(1), copSpeed: c.speed.toFixed(1), gap: Math.hypot(c.position.x - n.position.x, c.position.z - n.position.z).toFixed(0) };
  }));
}
await page.evaluate(() => { window.game.vehicles.remove(window.__sirenCop); });

// ---- motorcycle ----
await page.evaluate(() => {
  const g = window.game, p = g.player, h = p.heading;
  const v = g.vehicles.spawn('bike', p.position.x + Math.sin(h) * 2.5, p.position.z + Math.cos(h) * 2.5, h, { driver: null, color: 0xc0392b });
  window.__bike = v;
});
await waitGame(0.5);
await shot('t2_bike_parked', 0.5);
await page.keyboard.press('KeyF');
await waitGame(0.5);
console.log('in bike', await page.evaluate(() => !!window.game.player.vehicle && window.game.player.vehicle.type));
await hold('KeyW', 2500);
await page.keyboard.down('KeyW'); await page.keyboard.down('KeyA');
await waitGame(1.3);
console.log('lean', await page.evaluate(() => { const b = window.__bike; return { roll: b.roll.toFixed(2), speed: b.speed.toFixed(1), riderVisible: b.model.rider.visible }; }));
await shot('t2_bike_lean', 0.1);
await page.keyboard.up('KeyW'); await page.keyboard.up('KeyA');
await page.keyboard.press('KeyF');

// ---- helicopter ----
await page.evaluate(() => { const g = window.game; g.police.setWanted(5); g.police.heliCd = 0; });
await waitGame(2);
console.log('heli', await page.evaluate(() => { const h = window.game.police.helicopter; return h && { state: h.state, pos: [h.position.x, h.position.y, h.position.z].map(n => +n.toFixed(0)) }; }));
await waitGame(6);
// teleport the helicopter close in front of the camera for the screenshot
await page.evaluate(() => {
  const g = window.game, h = g.police.helicopter, p = g.player.position;
  h.position.set(p.x + 14, 20, p.z + 10); h.vel.set(0, 0, 0);
});
await shot('t2_heli_search', 0.3);
console.log('heli hit(miss)', await page.evaluate(() => window.game.police.helicopter.hit({ x: 0, y: 0, z: 0 }, 10)));
console.log('heli hit(on)', await page.evaluate(() => { const h = window.game.police.helicopter; return [h.hit({ x: h.position.x, y: h.position.y + 1.5, z: h.position.z }, 30), h.hp]; }));
console.log('rayHit', await page.evaluate(() => { const h = window.game.police.helicopter, o = { x: h.position.x, y: h.position.y + 1.5, z: h.position.z - 30 }; return [h.rayHit(o, { x: 0, y: 0, z: 1 }, 100), h.rayHit(o, { x: 0, y: 1, z: 0 }, 100)]; }));
await page.evaluate(() => { const h = window.game.police.helicopter; h.hit({ x: h.position.x, y: h.position.y + 1.5, z: h.position.z }, 500); });
await shot('t2_heli_crash', 0.8);
await waitGame(4);
console.log('heli state', await page.evaluate(() => window.game.police.helicopter?.state));
await shot('t2_heli_wreck', 0.5);
console.log('errors', errors);
await close();
if (errors.length) process.exit(1);
