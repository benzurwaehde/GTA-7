// Renders the app icon (neon "GTA 7 / VICE BAY" tile) to build/icon.png (1024x1024)
// and converts it to build/icon.icns with sips + iconutil (macOS only).
// Usage: node tools/make-icon.mjs
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

mkdirSync('build', { recursive: true });
const html = `<!doctype html><html><body style="margin:0;background:transparent">
<div style="width:1024px;height:1024px;display:flex;align-items:center;justify-content:center">
 <div style="width:824px;height:824px;border-radius:185px;position:relative;overflow:hidden;
   background:linear-gradient(160deg,#1b0636 0%,#3a0b5e 45%,#ff2d95 100%);
   box-shadow:inset 0 0 0 6px rgba(255,255,255,.08)">
  <div style="position:absolute;left:0;right:0;bottom:0;height:330px;
    background:repeating-linear-gradient(90deg,rgba(25,227,255,.35) 0 3px,transparent 3px 82px),
               repeating-linear-gradient(0deg,rgba(25,227,255,.35) 0 3px,transparent 3px 48px);
    transform:perspective(420px) rotateX(58deg);transform-origin:bottom"></div>
  <div style="position:absolute;left:50%;top:205px;width:300px;height:300px;margin-left:-150px;border-radius:50%;
    background:linear-gradient(180deg,#ffd24a 0%,#ff6a3d 55%,#ff2d95 100%);
    -webkit-mask:repeating-linear-gradient(180deg,#000 0 30px,transparent 30px 40px)"></div>
  <div style="position:absolute;top:120px;width:100%;text-align:center;font:italic 900 210px Impact,'Arial Black',sans-serif;
    color:#fff;letter-spacing:6px;text-shadow:0 0 18px #19e3ff,0 0 42px #19e3ff,6px 6px 0 #1b0636">GTA 7</div>
  <div style="position:absolute;bottom:120px;width:100%;text-align:center;font:italic 900 120px Impact,'Arial Black',sans-serif;
    color:#ffe14a;letter-spacing:4px;text-shadow:0 0 16px #ff2d95,0 0 36px #ff2d95,5px 5px 0 #1b0636">VICE BAY</div>
 </div></div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await page.setContent(html);
await page.screenshot({ path: 'build/icon.png', omitBackground: true });
await browser.close();

const set = 'build/icon.iconset';
rmSync(set, { recursive: true, force: true });
mkdirSync(set);
for (const s of [16, 32, 128, 256, 512]) {
  execFileSync('sips', ['-z', String(s), String(s), 'build/icon.png', '--out', `${set}/icon_${s}x${s}.png`], { stdio: 'ignore' });
  execFileSync('sips', ['-z', String(s * 2), String(s * 2), 'build/icon.png', '--out', `${set}/icon_${s}x${s}@2x.png`], { stdio: 'ignore' });
}
execFileSync('iconutil', ['-c', 'icns', set, '-o', 'build/icon.icns']);
rmSync(set, { recursive: true, force: true });
console.log('build/icon.png + build/icon.icns written');
