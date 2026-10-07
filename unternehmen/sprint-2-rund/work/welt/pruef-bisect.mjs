// Review script: binary-search the triangle in Shops body mesh that paints the black band (tag-ampel view).
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ server: { port: 7900 + Math.floor(Math.random() * 400) }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 300000 });
await page.keyboard.press('Enter');
await page.evaluate(() => { const g = window.game; g.player.update = () => {}; g.world.timeOfDay = 12; g.camera.fov = 60; g.camera.updateProjectionMatrix();
  g.camera.position.set(22, 4.5, 30); g.camera.lookAt(0, 4.5, 0); g.player.position.set(22, 0, 30); });
const t0 = await page.evaluate(() => window.game.time); await page.waitForFunction(t => window.game.time > t, t0 + 0.4, { timeout: 300000 });
await page.evaluate(() => { window.__dark = async (N) => { const g = window.game; const m = g.world.group.children[18]; m.geometry.setDrawRange(0, N);
  g.camera.position.set(22, 4.5, 30); g.camera.lookAt(0, 4.5, 0); g.camera.updateMatrixWorld(); g.renderer.render(g.scene, g.camera);
  const c = g.renderer.domElement; const img = new Image(); img.src = c.toDataURL(); await img.decode();
  const k = document.createElement('canvas'); k.width = c.width; k.height = c.height; const x = k.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 380, c.width, 100).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i+1] + d[i+2] < 30) n++; return n; }; });
const total = await page.evaluate(() => window.game.world.group.children[18].geometry.attributes.position.count);
const base = await page.evaluate(() => window.__dark(0)); const full = await page.evaluate((t) => window.__dark(t), total);
console.log('total', total, 'base', base, 'full', full);
let lo = 0, hi = total; const thr = base + (full - base) * 0.5;
while (hi - lo > 3) { const mid = Math.floor((lo + hi) / 6) * 3; const mm = Math.floor((lo + hi) / 2 / 3) * 3; const d = await page.evaluate((n) => window.__dark(n), mm); if (d >= thr) hi = mm; else lo = mm; if (hi - lo <= 3) break; }
const tri = hi / 3 - 1;
const info = await page.evaluate(([hi]) => { const m = window.game.world.group.children[18]; const p = m.geometry.attributes.position, c = m.geometry.attributes.color, nrm = m.geometry.attributes.normal; const out = [];
  for (let i = hi - 6; i < hi + 3; i++) out.push([p.getX(i), p.getY(i), p.getZ(i), c.getX(i), c.getY(i), c.getZ(i), nrm.getX(i), nrm.getY(i), nrm.getZ(i)].map((v) => +v.toFixed(2)));
  return out; }, [hi]);
console.log('tri index', tri, JSON.stringify(info));
await browser.close(); await server.close();
