// T3 welt: screenshots + signalAt checks. Usage (from repo root): node unternehmen/sprint-2-rund/work/welt/shots.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
const OUT = 'unternehmen/sprint-2-rund/work/welt/';
const server = await createServer({ server: { port: 6400 + Math.floor(Math.random() * 400) }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e.stack || e)));
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 180000 });
await page.keyboard.press('Enter');
// free camera: freeze the player's camera control, keep world running
await page.evaluate(() => { const g = window.game; g.player.update = () => {}; g.world.timeOfDay = 12; });
const cam = async (name, hour, [px, py, pz], [lx, ly, lz], fov = 60) => {
  await page.evaluate(([hour, p, l, fov]) => {
    const g = window.game; g.world.timeOfDay = hour; g.camera.fov = fov; g.camera.updateProjectionMatrix();
    g.camera.position.set(...p); g.camera.lookAt(...l);
    g.player.position.set(p[0], 0, p[2]); // keeps shadow/streaming focus
  }, [hour, [px, py, pz], [lx, ly, lz], fov]);
  const t0 = await page.evaluate(() => window.game.time);
  await page.waitForFunction(t => window.game.time > t, t0 + 0.5, { timeout: 120000 });
  await page.evaluate(([p, l]) => { const g = window.game; g.camera.position.set(...p); g.camera.lookAt(...l); }, [[px, py, pz], [lx, ly, lz]]);
  await page.screenshot({ path: OUT + name + '.png' }); console.log('shot', name);
};
await cam('tag-ampel', 12, [22, 4.5, 30], [0, 4.5, 0]);
await cam('runde2-tag-innen', 12, [22, 4.5, 30], [0, 4.5, 0]); // Kamerastellung wie pruef-inside-mit.png
await cam('runde2-tag-gehweg', 12, [8.6, 2.2, 22], [8.6, 2.2, 60], 60);
await cam('runde2-nacht-gehweg', 22.5, [8.6, 2.2, 22], [8.6, 2.2, 60], 60);
await cam('tag-laeden', 12, [-25, 3, 52], [-25, 3.5, 40], 70);
await cam('tag-strasse', 15, [-8, 6, 100], [-8, 4, -20], 60);
await cam('nacht-ampel', 22.5, [22, 4.5, 30], [0, 4.5, 0]);
await cam('nacht-laeden', 22.5, [-25, 3, 52], [-25, 3.5, 40], 70);
await cam('nacht-strasse', 22.5, [-8, 6, 100], [-8, 4, -20], 60);
await cam('nacht-downtown', 22.5, [8, 14, 60], [-30, 14, -20], 75);

const info = await page.evaluate(() => {
  const g = window.game, w = g.world, out = {};
  out.far = w.signalAt(37, 0, 'ns'); // between intersections (>25 m)
  out.hasFn = typeof w.signalAt;
  // sweep one intersection over 30 s of simulated time via game.time shifts
  const seq = []; const t0 = g.time;
  let bad = 0;
  for (let k = 0; k < 220; k++) {
    g.time = t0 + k * 0.1;
    const a = w.signalAt(3, 3, 'ns'), b = w.signalAt(3, 3, 'ew');
    if (a !== 'red' && b !== 'red') bad++;
    const key = a + '/' + b; if (seq[seq.length - 1] !== key) seq.push(key);
  }
  g.time = t0;
  out.sequence = seq; out.bothNonRed = bad; out.edgeNull = w.signalAt(-5000, 5000, 'ns');
  const t = performance.now(); for (let i = 0; i < 100000; i++) w.signalAt(i % 300, 5, 'ns'); out.ms100k = Math.round(performance.now() - t);
  out.draw = g.renderer.info.render.calls; out.tris = g.renderer.info.render.triangles;
  out.furniture = w._furnitureCount; out.shops = w.shops._shopCount; out.neon = w.shops._neonCount;
  return out;
});
console.log(JSON.stringify(info));
await browser.close(); await server.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('SHOTS OK');
