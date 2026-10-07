// Review script: confirm the black band = awning undersides seen from inside/under the shopfront.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const OUT = 'unternehmen/sprint-2-rund/work/welt/';
const server = await createServer({ server: { port: 8800 + Math.floor(Math.random() * 400) }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 300000 });
await page.keyboard.press('Enter');
const setCam = (p, l) => page.evaluate(([p, l]) => { const g = window.game; g.player.update = () => {}; g.world.timeOfDay = 12; g.camera.fov = 60; g.camera.updateProjectionMatrix();
  g.player.position.set(p[0], 0, p[2]); g.camera.position.set(...p); g.camera.lookAt(...l); }, [p, l]);
const wait = async () => { const t0 = await page.evaluate(() => window.game.time); await page.waitForFunction(t => window.game.time > t, t0 + 0.5, { timeout: 300000 });
  await page.evaluate(() => { window.__cam && window.__cam(); }); };
const views = { inside: [[22, 4.5, 30], [0, 4.5, 0]], sidewalk: [[8.6, 2.2, 22], [8.6, 2.2, 60]] };
for (const [name, [p, l]] of Object.entries(views)) {
  await setCam(p, l); await page.evaluate(([p, l]) => { window.__cam = () => { const g = window.game; g.camera.position.set(...p); g.camera.lookAt(...l); }; }, [p, l]);
  await wait(); await page.screenshot({ path: OUT + 'pruef-' + name + '-mit.png' });
  // drop downward-facing triangles of the shop body mesh (awning undersides)
  await page.evaluate(() => { const m = window.game.world.group.children[18]; const g = m.geometry; if (!g.__orig) g.__orig = g.index; const n = g.attributes.normal, idx = []; for (let i = 0; i < n.count; i += 3) if (n.getY(i) > -0.5) idx.push(i, i + 1, i + 2); g.setIndex(idx); });
  await wait(); await page.screenshot({ path: OUT + 'pruef-' + name + '-ohne-unterseiten.png' });
  await page.evaluate(() => { const g = window.game.world.group.children[18].geometry; g.setIndex(null); });
}
await browser.close(); await server.close();
