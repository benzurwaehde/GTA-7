// Review script: bisect the black band in tag-ampel by hiding world children one by one.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const OUT = 'unternehmen/sprint-2-rund/work/welt/';
const server = await createServer({ server: { port: 7000 + Math.floor(Math.random() * 400) }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 300000 });
await page.keyboard.press('Enter');
await page.evaluate(() => { const g = window.game; g.player.update = () => {}; g.world.timeOfDay = 12; g.camera.fov = 60; g.camera.updateProjectionMatrix();
  g.camera.position.set(22, 4.5, 30); g.camera.lookAt(0, 4.5, 0); g.player.position.set(22, 0, 30); });
const settle = async () => { const t0 = await page.evaluate(() => window.game.time); await page.waitForFunction(t => window.game.time > t, t0 + 0.4, { timeout: 300000 });
  await page.evaluate(() => { const g = window.game; g.camera.position.set(22, 4.5, 30); g.camera.lookAt(0, 4.5, 0); }); };
const dark = async () => page.evaluate(async () => { // count near-black pixels in canvas via readPixels not possible; use toDataURL
  const g = window.game; g.renderer.render(g.scene, g.camera);
  const c = g.renderer.domElement; const url = c.toDataURL(); const img = new Image(); img.src = url; await img.decode();
  const k = document.createElement('canvas'); k.width = c.width; k.height = c.height; const x = k.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 380, c.width, 100).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i+1] + d[i+2] < 30) n++; return n; });
await settle();
const info = await page.evaluate(() => { const g = window.game; return g.world.group.children.map((c, i) => `${i}:${c.type}:${c.name || ''}:${c.geometry?.type || ''}:${c.count ?? ''}:cs=${c.castShadow}`); });
console.log(info.join('\n'));
console.log('baseline', await dark());
const n = await page.evaluate(() => window.game.world.group.children.length);
for (let i = 0; i < n; i++) {
  await page.evaluate((i) => { window.game.world.group.children[i].visible = false; }, i);
  const d = await dark();
  await page.evaluate((i) => { window.game.world.group.children[i].visible = true; }, i);
  console.log('hide', i, d);
}
await browser.close(); await server.close();
