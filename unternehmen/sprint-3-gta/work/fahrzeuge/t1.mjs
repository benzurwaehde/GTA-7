// Vehicle showcase with a free camera: every new type, then dents / cracked windows and the charred wreck.
import { boot } from './lib.mjs';
const { page, errors, waitGame, shot, close } = await boot();
await page.evaluate(async () => {
  const { ROAD_LINES } = await import('/src/core/config.js');
  const g = window.game, p = g.player;
  window.__cx = ROAD_LINES[3]; window.__z0 = (ROAD_LINES[3] + ROAD_LINES[4]) / 2 - 22;
  p.position.set(window.__cx - 5, 0, window.__z0 - 20); p.mesh.visible = false;
  p.cam.update = () => {};       // free camera for the test
  window.__look = (x, y, z, tx, ty, tz) => { g.camera.position.set(x, y, z); g.camera.lookAt(tx, ty, tz); g.camera.updateMatrixWorld(); };
});
const park = async (types, spots) => page.evaluate(([types, spots]) => {
  const g = window.game, vm = g.vehicles;
  for (const v of vm.list.slice()) if (v.userRow) vm.remove(v);
  types.forEach((t, i) => {
    const [dx, dz, hd] = spots[i];
    const v = vm.spawn(t, window.__cx + dx, window.__z0 + dz, hd, { driver: null, color: [0xc0392b, 0x2980b9, 0xe67e22, 0x27ae60][i % 4] });
    v.userRow = true; v.sleeping = true;
  });
  for (const v of vm.list.slice()) if (!v.userRow && !v.owned && Math.hypot(v.position.x - window.__cx, v.position.z - window.__z0) < 60) vm.remove(v);
}, [types, spots]);
const look = (...a) => page.evaluate(a => window.__look(...a), a);
const H = Math.PI / 2;

// gallery: profile view, cars side-on in a row along the road
await park(['bike', 'muscle', 'van', 'bus'], [[0, -9, H], [0, -2.5, H], [0, 4.5, H], [0, 14, H]]);
await page.evaluate(() => window.__look(window.__cx + 17, 4.2, window.__z0 + 3, window.__cx, 1.2, window.__z0 + 3));
await shot('t1_new_types', 0.6);

// damage: dent close-up, cracked windows, wreck
await park(['muscle', 'muscle', 'muscle'], [[0, -7, H + 0.5], [0, 0, H + 0.5], [0, 7, H + 0.5]]);
await page.evaluate(() => {
  const vm = window.game.vehicles, row = vm.list.filter(v => v.userRow).sort((a, b) => a.position.z - b.position.z);
  const a = row[1];
  for (let i = 0; i < 5; i++) a.dentAt(a.position.x + Math.sin(a.heading) * 2.2, a.position.z + Math.cos(a.heading) * 2.2, 0.3);
  a.dentAt(a.position.x + Math.cos(a.heading) * 1.0, a.position.z - Math.sin(a.heading) * 1.0, 0.3);
  a.health = 40; vm.damage(a, 1);                   // windows crack at < 60, smoke from < 50
  window.__burn = row[2];
});
await page.evaluate(() => window.__look(window.__cx + 3.5, 2.6, window.__z0 - 12, window.__cx - 1, 0.8, window.__z0 + 3));
await shot('t1_damage_dents_glass', 0.6);
await page.evaluate(() => { const vm = window.game.vehicles; window.__burn.health = 40; vm.damage(window.__burn, 100); });
await page.evaluate(() => window.__look(window.__cx + 9, 3.2, window.__z0 + 17, window.__cx, 1.0, window.__z0 + 7));
await shot('t1_blast_debris', 0.45);
await shot('t1_wreck_charred', 5);
await page.evaluate(() => window.__look(window.__cx + 6, 2.2, window.__z0 - 2, window.__cx, 0.8, window.__z0 + 6));
await shot('t1_wreck_vs_dented', 0.3);
console.log('errors', errors);
await close();
if (errors.length) process.exit(1);
