import { createServer } from 'vite';
import { chromium } from 'playwright';
const OUT = process.env.OUTDIR;
const server = await createServer({ server: { port: 9200 + Math.floor(Math.random() * 400), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 300000 });
await page.keyboard.press('Enter');
const cam = async (name, hour, p, l, fov = 60) => {
  await page.evaluate(([hour, p, l, fov]) => { const g = window.game; g.player.update = () => {}; g.world.timeOfDay = hour; g.camera.fov = fov; g.camera.updateProjectionMatrix();
    g.player.position.set(p[0], 0, p[2]); g.camera.position.set(...p); g.camera.lookAt(...l); }, [hour, p, l, fov]);
  const t0 = await page.evaluate(() => window.game.time);
  await page.waitForFunction(t => window.game.time > t, t0 + 0.5, { timeout: 300000 });
  await page.evaluate(([p, l]) => { const g = window.game; g.camera.position.set(...p); g.camera.lookAt(...l); }, [p, l]);
  await page.screenshot({ path: OUT + '/' + name + '.png' });
};
await cam('inside', 12, [22, 4.5, 30], [0, 4.5, 0]);
await cam('under', 12, [8.6, 2.0, 30], [20, 2.4, 30]);
await cam('under2', 12, [14, 2.2, 22], [14, 6, 40]);
await cam('wall', 12, [8.6, 2.2, 22], [30, 2.5, 22], 70);
await cam('shopsday', 12, [-25, 3, 52], [-25, 3.5, 40], 70);
await cam('nightwalk', 22.5, [8.6, 2.2, 22], [8.6, 2.2, 60]);
await cam('nightstreet', 22.5, [-8, 6, 100], [-8, 4, -20]);
await cam('nightdown', 22.5, [22, 4.5, 30], [0, 4.5, 0]);
const info = await page.evaluate(() => {
  const g = window.game, w = g.world, out = { down: {} };
  w.group.children.forEach((m, i) => {
    if (!m.geometry || !m.geometry.attributes.position) return;
    const geo = m.geometry, pos = geo.attributes.position, idx = geo.index; let n = 0, tot = 0;
    const cnt = idx ? idx.count : pos.count;
    const A = [0,0,0], B = [0,0,0], C = [0,0,0];
    const side = m.material.side; 
    for (let t = 0; t < cnt; t += 3) {
      const ia = idx ? idx.getX(t) : t, ib = idx ? idx.getX(t+1) : t+1, ic = idx ? idx.getX(t+2) : t+2;
      const ax = pos.getX(ia), ay = pos.getY(ia), az = pos.getZ(ia);
      const ux = pos.getX(ib)-ax, uy = pos.getY(ib)-ay, uz = pos.getZ(ib)-az, vx = pos.getX(ic)-ax, vy = pos.getY(ic)-ay, vz = pos.getZ(ic)-az;
      const ny = uz*vx - ux*vz, nx = uy*vz-uz*vy, nz = ux*vy-uy*vx; const l = Math.hypot(nx,ny,nz); tot++;
      if (l > 1e-9 && ny/l < -0.5 && m.visible !== false) n++;
    }
    if (n) out.down[i + ':' + (m.name||m.type) + ':' + (m.isInstancedMesh?'inst':'') + ':side' + side] = n + '/' + tot;
  });
  out.far = w.signalAt(37, 0, 'ns'); out.edge = w.signalAt(-5000, 5000, 'ns');
  const seq = []; const t0 = g.time; let bad = 0;
  for (let k = 0; k < 220; k++) { g.time = t0 + k*0.1; const a = w.signalAt(3,3,'ns'), b = w.signalAt(3,3,'ew'); if (a!=='red'&&b!=='red') bad++; const key=a+'/'+b; if (seq[seq.length-1]!==key) seq.push(key); }
  g.time = t0; out.seq = seq; out.bad = bad;
  return out;
});
console.log(JSON.stringify(info, null, 1));
await browser.close(); await server.close();
