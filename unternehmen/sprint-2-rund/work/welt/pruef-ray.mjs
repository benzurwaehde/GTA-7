// Review script: shoot rays through the black-band pixels (tag-ampel view) and list nearest triangles hit.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ server: { port: 8400 + Math.floor(Math.random() * 400) }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 300000 });
await page.keyboard.press('Enter');
await page.evaluate(() => { const g = window.game; g.player.update = () => {}; g.world.timeOfDay = 12; g.camera.fov = 60; g.camera.updateProjectionMatrix();
  g.camera.position.set(22, 4.5, 30); g.camera.lookAt(0, 4.5, 0); g.camera.updateMatrixWorld(); });
const res = await page.evaluate(() => {
  const g = window.game, V = g.camera.position.constructor, cam = g.camera;
  const meshes = g.world.group.children.map((m, i) => [i, m]).filter(([i, m]) => m.isMesh && !m.isInstancedMesh && m.geometry.attributes?.position && m.geometry.attributes.position.count > 100);
  const out = [];
  for (const [px, py] of [[100, 440], [300, 430], [900, 400], [1100, 410], [640, 420]]) {
    const ndc = new V((px / 1280) * 2 - 1, -(py / 720) * 2 + 1, 0.5).unproject(cam);
    const o = cam.position.clone(), d = ndc.sub(o).normalize();
    const hits = [];
    for (const [i, m] of meshes) {
      const P = m.geometry.attributes.position, n = P.count / 3;
      for (let t = 0; t < n; t++) {
        const a = [0, 1, 2].map((k) => new V(P.getX(t * 3 + k), P.getY(t * 3 + k), P.getZ(t * 3 + k)));
        const e1 = a[1].clone().sub(a[0]), e2 = a[2].clone().sub(a[0]), h = d.clone().cross(e2), det = e1.dot(h);
        if (Math.abs(det) < 1e-9) continue;
        const s = o.clone().sub(a[0]), u = s.dot(h) / det; if (u < 0 || u > 1) continue;
        const q = s.clone().cross(e1), v = d.dot(q) / det; if (v < 0 || u + v > 1) continue;
        const dist = e2.dot(q) / det; if (dist > 0) hits.push({ i, t, dist: +dist.toFixed(1), tri: a.map((x) => x.toArray().map((z) => +z.toFixed(1))), col: P.constructor && m.geometry.attributes.color ? [m.geometry.attributes.color.getX(t * 3), m.geometry.attributes.color.getY(t * 3), m.geometry.attributes.color.getZ(t * 3)].map((z) => +z.toFixed(2)) : null });
      }
    }
    hits.sort((a, b) => a.dist - b.dist); out.push({ px, py, hits: hits.slice(0, 3) });
  }
  return out;
});
console.log(JSON.stringify(res));
await browser.close(); await server.close();
