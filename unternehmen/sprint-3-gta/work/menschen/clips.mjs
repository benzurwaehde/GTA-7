// Clip viewer: poses a Human at fixed clip times next to the player and screenshots a side view.
// Usage: tools/heavy.sh node unternehmen/sprint-3-gta/work/menschen/clips.mjs [clip ...]
import { createServer } from 'vite';
import { chromium } from 'playwright';
const OUT = 'unternehmen/sprint-3-gta/work/menschen';
const clips = process.argv.slice(2).length ? process.argv.slice(2) : ['death'];
const server = await createServer({ server: { port: 5600 + Math.floor(Math.random() * 100), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.on('pageerror', e => console.log('ERR', e));
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 180000 });
await page.keyboard.press('Enter');
await page.waitForTimeout(1000);
await page.evaluate(async () => {
  const g = window.game, { Human } = await import('/src/characters/Human.js');
  window.__H = new Human('human_man_a', { shirt: 0xd9453b, pants: 0x2a3550, hair: 0x3a2418, skin: 0xe0ac86 });
  g.scene.add(window.__H.root);
  const p = g.player.position; window.__H.root.position.set(p.x, 0, p.z + 3); window.__H.root.rotation.y = 0;
  g.player.mesh.visible = false;
  g.systems.push({ name: 'tc', system: { update() { const r = window.__H.root.position; g.camera.position.set(r.x + 3.6, 1.1, r.z); g.camera.lookAt(r.x, 0.9, r.z); } } });
});
for (const c of clips) {
  const dur = await page.evaluate(n => { const a = window.__H.actions[n]; return a ? a.getClip().duration : 0; }, c);
  console.log(c, 'duration', dur);
  const steps = [0, 0.25, 0.5, 0.75, 1].map(f => f * dur * 0.999);
  for (let i = 0; i < steps.length; i++) {
    await page.evaluate(([n, t]) => { const h = window.__H; h.mixer.stopAllAction(); const a = h.actions[n]; a.reset().play(); a.paused = true; h.mixer.setTime(0); a.time = t; h.mixer.update(0); }, [c, steps[i]]);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/clip-${c}-${i}.png` });
  }
}
await browser.close(); await server.close();
