// Screenshots of the T3 world additions (water, harbour, landmarks, facades) at day and night, plus a draw-call
// measurement at the spawn point. Usage: tools/heavy.sh node unternehmen/sprint-3-gta/work/stadt/shots.mjs [filter]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

const ROOT = process.env.BASE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..'); // BASE_ROOT: measure another checkout (baseline)
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots');
mkdirSync(OUT, { recursive: true });
const H = 303;
const filter = process.argv[2] || '';

// [name, hour, camera [x,y,z], look [x,y,z]]
const SHOTS = [
  ['water-coast-day', 14, [120, 5, H + 12], [150, 0, H + 70]],
  ['pier-day', 11, [14, 7, H + 4], [0, 1, H + 90]],
  ['harbor-day', 13, [20, 14, H + 18], [95, 8, H + 45]],
  ['harbor-boats-day', 15, [-16, 6, H + 30], [0, 0, H + 85]],
  ['skyline-day', 10, [-37, 30, H + 18], [-37, 90, 37]],
  ['tower-day', 12, [-90, 6, 90], [-37, 100, 37]],
  ['wheel-day', 16, [-20, 6, H + 2], [-48, 15, H + 14]],
  ['lighthouse-day', 17, [170, 8, H + 8], [205, 20, H + 20]],
  ['outskirts-west-day', 12, [-296, 18, -148], [-200, 4, -148]],
  ['outskirts-east-day', 12, [222, 18, 148], [150, 4, 148]],
  ['roofs-day', 12, [-150, 70, -40], [-100, 20, 0]],
  ['water-night', 22.5, [120, 5, H + 12], [150, 0, H + 70]],
  ['pier-night', 22, [14, 7, H + 4], [0, 1, H + 90]],
  ['harbor-night', 22, [20, 14, H + 18], [95, 8, H + 45]],
  ['wheel-night', 22, [-20, 6, H + 2], [-48, 15, H + 14]],
  ['lighthouse-night', 22.5, [170, 8, H + 8], [205, 20, H + 20]],
  ['skyline-night', 23, [-37, 25, 150], [-37, 90, 37]],
  ['windows-night', 22.5, [60, 40, 60], [20, 30, 30]],
  ['outskirts-night', 22.5, [-296, 18, -148], [-200, 4, -148]],
];

const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 6600 + Math.floor(Math.random() * 400), strictPort: false, hmr: false, watch: null } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e.stack || e)));
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 180000 });
await page.keyboard.press('Enter');

// measurement at the spawn point (fixed position, daytime)
await page.waitForFunction(() => window.game.time > 3, null, { timeout: 120000 });
const measure = (tag = '') => page.evaluate((tag) => {
  const g = window.game; g.renderer.info.autoReset = false;
  const hidden = []; // world only: hide every other scene child (peds, cars, player, effects) for one frame
  const world = g.world.group;
  g.scene.children.forEach((c) => { if (c !== world && c.visible) { c.visible = false; hidden.push(c); } });
  if (tag === 'all') { world.children.forEach((c, i) => { if (c.userData.t3 || (c.isMesh && c.material.map && c.material.emissiveMap && [3, 4].includes(g.world.mat.facade.indexOf(c.material))) || (c.isMesh && c.castShadow && c.frustumCulled && !c.userData.t3 && c.material.vertexColors && c.material !== g.world.mat.roof && false)) { if (c.visible) { c.visible = false; hidden.push(c); } } }); }
  const tagged = tag ? world.children.filter((c) => c.userData.t3 === tag && c.visible) : [];
  tagged.forEach((c) => { c.visible = false; hidden.push(c); });
  g.renderer.info.reset();
  return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const i = g.renderer.info.render; const r = { calls: i.calls, triangles: i.triangles };
    hidden.forEach((c) => { c.visible = true; }); g.renderer.info.autoReset = true; res(r);
  })));
}, tag);
const calls = await measure();
console.log('spawn draw calls, world only (one frame incl. shadow pass):', JSON.stringify(calls));
console.log('world children:', await page.evaluate(() => window.game.world.group.children.map((c) => `${c.type}${c.userData.t3 ? ':' + c.userData.t3 : ''}${c.castShadow ? '*' : ''}${c.frustumCulled ? '' : '!'}`).join(' ')));
for (const t of ['harbor', 'landmark', 'all']) console.log('  without', t, JSON.stringify(await measure(t)));
// same measurement with a fixed free camera at the spawn point looking north (away from the coast) and south (towards it)
await page.evaluate(() => { const g = window.game; g.player.cam.update = () => {}; });
for (const [lbl, look] of [['north', [8.5, 6, -300]], ['south', [8.5, 6, 400]]]) {
  await page.evaluate((look) => { const g = window.game; g.camera.position.set(8.5, 3, 20); g.camera.lookAt(...look); g.camera.updateMatrixWorld(); }, look);
  console.log('  camera', lbl, JSON.stringify(await measure()));
}
if (process.env.CALLS_ONLY) { await browser.close(); await server.close(); process.exit(0); }
// free camera: stop the player's camera rig, keep the game running
await page.evaluate(() => { const g = window.game; g.player.cam.update = () => {}; g.paused = false; document.getElementById('ui').style.display = 'none'; });
const LM = await page.evaluate(() => window.game.world.landmarks.list);
const pav = LM.find((l) => l.type === 'pavilion');
if (pav) SHOTS.push(['pavilion-day', 12, [pav.x + 13, 5, pav.z + 13], [pav.x, 3, pav.z]]);
SHOTS.push(['ship-day', 14, [50, 9, H + 36], [100, 9, H + 61]], ['ship-bow-day', 15, [150, 8, H + 40], [130, 6, H + 61]], ['tower-plaza-day', 12, [-37 + 30, 4, 37 + 30], [-37, 12, 37]],
  ['ship-night', 22, [50, 9, H + 36], [100, 9, H + 61]]);
for (const [name, hour, cam, look] of SHOTS) {
  if (filter && !name.includes(filter)) continue;
  await page.evaluate(([hour, cam, look]) => {
    const g = window.game; g.world.timeOfDay = hour;
    g.player.teleport?.(cam[0], cam[2]); // keep peds / streaming around the camera
    g.camera.position.set(...cam); g.camera.lookAt(...look); g.camera.updateMatrixWorld();
  }, [hour, cam, look]);
  const t0 = await page.evaluate(() => window.game.time);
  await page.waitForFunction((t) => window.game.time > t, t0 + 0.8, { timeout: 120000 });
  await page.evaluate(([cam, look]) => { const g = window.game; g.camera.position.set(...cam); g.camera.lookAt(...look); }, [cam, look]);
  await page.waitForFunction((t) => window.game.time > t, t0 + 1.0, { timeout: 120000 });
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  console.log('shot', name);
}
await browser.close(); await server.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('SHOTS OK');
