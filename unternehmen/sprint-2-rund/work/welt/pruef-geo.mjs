// Review script: inspect Shops body mesh triangles for oversized / black ones.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ server: { port: 7500 + Math.floor(Math.random() * 400) }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.game && window.game.time > 0.2, null, { timeout: 300000 });
const r = await page.evaluate(() => {
  const g = window.game, m = g.world.group.children[18];
  const p = m.geometry.attributes.position, c = m.geometry.attributes.color, out = [];
  const bb = m.geometry.boundingBox;
  let n = p.count / 3, big = [], dark = 0;
  for (let i = 0; i < n; i++) {
    const a = [0, 1, 2].map((k) => [p.getX(i * 3 + k), p.getY(i * 3 + k), p.getZ(i * 3 + k)]);
    let ext = 0; for (let k = 0; k < 3; k++) for (let l = k + 1; l < 3; l++) ext = Math.max(ext, Math.hypot(a[k][0] - a[l][0], a[k][1] - a[l][1], a[k][2] - a[l][2]));
    const lum = c.getX(i * 3) + c.getY(i * 3) + c.getZ(i * 3);
    if (lum < 0.4) dark++;
    if (ext > 12) big.push({ ext: +ext.toFixed(1), a: a.map((v) => v.map((x) => +x.toFixed(1))), col: [c.getX(i * 3), c.getY(i * 3), c.getZ(i * 3)].map((x) => +x.toFixed(2)) });
  }
  const byBld = {};
  return { tris: n, dark, nbig: big.length, big: big.slice(0, 15), bb: [bb.min.toArray(), bb.max.toArray()], mat: m.material.type };
});
console.log(JSON.stringify(r, null, 1));
await browser.close(); await server.close();
