import { boot, SHOTS } from './lib.mjs';
const { page, errors, waitGame, close } = await boot();
const ev = (fn, a) => page.evaluate(fn, a);
await page.keyboard.down('Tab'); await page.waitForTimeout(300);
await ev(() => { const w = window.game.weaponWheel; w.stick.x = 70; w.stick.y = 90; });
for (let i = 0; i < 4; i++) { await page.waitForTimeout(200); console.log(JSON.stringify(await ev(() => { const w = window.game.weaponWheel; return { s: w.stick, h: w.hover, o: w.open, t: window.game.time }; }))); }
await page.keyboard.up('Tab');
await close();
