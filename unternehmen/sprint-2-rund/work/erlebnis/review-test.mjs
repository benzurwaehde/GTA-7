import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ logLevel: 'error', server: { hmr: false, watch: null, port: 5600 + Math.floor(Math.random()*300) } });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1000, height: 600 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERR ' + e));
const ev = (f, a) => page.evaluate(f, a);
const wait = async s => { const t0 = await ev(() => window.game.time); await page.waitForFunction(t => window.game.time > t, t0 + s, { timeout: 120000 }); };
const boot = async () => { await page.goto(url); await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 240000 }); await wait(1); };
// seed bad saves before load
const bads = ['{', 'null', '[]', '"x"', '{"v":0}', '{"v":1,"money":"abc","completed":"x","ammo":5,"time":"n","pos":null}',
  '{"v":1,"money":-5,"completed":[1,null,{}],"ammo":{"pistol":{"ammo":"x","clip":-1}},"time":99,"pos":{"x":1e9,"z":NaN}}',
  '{"v":1,"money":1e30,"completed":null,"ammo":null,"time":null,"pos":{"x":"a"}}', '{"v":1,"pos":{"x":0,"z":0}}'];
await page.addInitScript(() => {});
await page.goto(url + '#');
for (const b of bads) {
  await page.evaluate(b => localStorage.setItem('gta7.save', b), b);
  const n0 = errors.length;
  await boot();
  const st = await ev(() => ({ m: game.state.money, p: game.player.position.toArray(), t: game.world.timeOfDay, a: game.player.weapons.states.map(s=>[s.id,s.ammo,s.clip]) }));
  console.log('BAD', b.slice(0,50), 'newerr', errors.length - n0, JSON.stringify(st));
  const ok = await ev(() => game.player.position.toArray().every(Number.isFinite));
  if (!ok) console.log('  POSITION NaN!');
}
// pickups vs colliders
await boot();
const inside = await ev(() => {
  const cs = game.world.colliders, out = [];
  game.pickups.items.forEach((it, i) => { for (const c of cs) if (c.type !== 'boundary' && it.x > c.minX-0.5 && it.x < c.maxX+0.5 && it.z > c.minZ-0.5 && it.z < c.maxZ+0.5 && c.maxY > 0.5) { out.push([i, it.type, it.x, it.z, c.type]); break; } });
  return out;
});
console.log('PICKUPS_IN_COLLIDERS', JSON.stringify(inside));
// save roundtrip + new game
await ev(() => { game.state.money = 4321; game.save.save(); });
console.log('SAVED', await ev(() => localStorage.getItem('gta7.save')));
await ev(() => { game.hud.btnNew.click(); });
console.log('armed', await ev(() => game.hud.btnNew.textContent));
await Promise.all([page.waitForNavigation({ timeout: 60000 }).catch(()=>{}), ev(() => game.hud.btnNew.click())]);
await page.waitForFunction(() => window.game && window.game.time > 0.5, null, { timeout: 240000 });
await wait(2);
console.log('AFTER NEWGAME save', await ev(() => localStorage.getItem('gta7.save')), 'money', await ev(() => game.state.money), 'missions', await ev(() => localStorage.getItem('gta7.missions.completed')));
await wait(1);
await ev(() => { window.__r=[]; game.events.on('mission:failed', e=>window.__r.push(e.reason)); game.missions.start('chase'); });
await wait(0.3);
await ev(() => { const g=game, p=g.player.position; g.vehicles.spawn('sedan', p.x+2, p.z, 0, {driver:null}); g.player.tryEnterVehicle(); });
await wait(0.6);
console.log('in car', await ev(()=>!!game.player.vehicle), 'stage', await ev(()=>game.missions.active?.stage));
const tgt = await ev(() => { const t=game.missions.active.data.target; return t ? [t.position.x,t.position.z, t.ai?.factor, t.driver] : null; });
console.log('thief', JSON.stringify(tgt));
for (let i=0;i<8;i++){ await wait(4); console.log(' t', await ev(() => { const m=game.missions.active; if(!m) return 'ended '+JSON.stringify(game.missions.completed); const t=m.data.target; return m.progress+' time '+m.timeLeft.toFixed(0)+' speed '+t.speed.toFixed(1)+' inList '+game.vehicles.list.includes(t) }));}
await ev(() => { game.missions.active?.timeLeft!=null && (game.missions.active.timeLeft=0.1); });
await wait(0.5);
console.log('reasons', await ev(()=>JSON.stringify(window.__r)));
console.log('chase timeout active', await ev(() => !!game.missions.active));
// chase: stop win
await ev(() => { game.missions.start('chase'); });
await wait(0.3);
await ev(() => { const m=game.missions.active; });
console.log('restart', await ev(()=>game.missions.active?.name+' stage '+game.missions.active?.stage));
await ev(() => { const g=game; g.vehicles.remove(g.player.vehicle); g.player.vehicle=null; g.player.mesh.visible=true; });
console.log('DRAW', await ev(() => game.renderer.info.render.calls));
console.log('ERRORS', JSON.stringify(errors));
await browser.close(); await server.close();
