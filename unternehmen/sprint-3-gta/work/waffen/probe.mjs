import { boot } from './lib.mjs';
const { page, errors, close } = await boot();
const r = await page.evaluate(async () => {
  const { CITY, blockBounds } = await import('/src/core/config.js');
  const g = window.game, cols = g.world.colliders.filter(b => !b.invisible);
  const sp = g.world.getSpawnPoint();
  const W = 12, D = 8, found = [];
  const free = (x0, z0, x1, z1) => !cols.some(b => b.minX < x1 + 1.5 && b.maxX > x0 - 1.5 && b.minZ < z1 + 1.5 && b.maxZ > z0 - 1.5);
  for (let i = 0; i < CITY.blocks; i++) for (let j = 0; j < CITY.blocks; j++) {
    const b = blockBounds(i, j);
    for (const side of ['n', 's', 'e', 'w']) for (let t = 12; t <= 48; t += 3) {
      let x0, z0, x1, z1;
      if (side === 'n') { x0 = b.minX + t - W / 2; x1 = x0 + W; z0 = b.minZ + 3.3; z1 = z0 + D; }
      if (side === 's') { x0 = b.minX + t - W / 2; x1 = x0 + W; z1 = b.maxZ - 3.3; z0 = z1 - D; }
      if (side === 'w') { z0 = b.minZ + t - W / 2; z1 = z0 + W; x0 = b.minX + 3.3; x1 = x0 + D; }
      if (side === 'e') { z0 = b.minZ + t - W / 2; z1 = z0 + W; x1 = b.maxX - 3.3; x0 = x1 - D; }
      if (free(x0, z0, x1, z1)) found.push({ i, j, side, t, d: Math.round(Math.hypot((x0 + x1) / 2 - sp.x, (z0 + z1) / 2 - sp.z)) });
    }
  }
  found.sort((a, c) => a.d - c.d);
  return { total: found.length, near: found.slice(0, 15), sp };
});
console.log(JSON.stringify(r));
await close();
