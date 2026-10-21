// Render the share image and the icons from the site's own fonts and inks, with headless Chrome.
//   node scripts/render-meta.mjs        writes assets/meta/{og.png, icon-512.png, icon-192.png, apple-touch-icon.png, favicon.ico}
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'meta');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const font = (f) => `data:font/woff2;base64,${readFileSync(join(ROOT, 'assets', 'fonts', 'google', f)).toString('base64')}`;
const FONTS = `
@font-face { font-family: "Big Shoulders Display"; font-weight: 700 900; src: url(${font('big-shoulders-display-latin-1.woff2')}) format("woff2"); }
@font-face { font-family: "Recursive"; font-weight: 300 1000; font-style: oblique 0deg 15deg; src: url(${font('recursive-latin-8.woff2')}) format("woff2"); }`;
const INK = { paper: '#ECEAE4', sheet: '#FAF9F6', ink: '#18171C', pink: '#FF48B0', blue: '#0078BF', yellow: '#FFE800' };
const NOISE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .1  0 0 0 0 .09  0 0 0 0 .11  0 0 0 .1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const og = `<!doctype html><meta charset="utf-8"><style>${FONTS}
html, body { margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; background: ${INK.paper} ${NOISE}; color: ${INK.ink}; font-family: "Recursive"; font-variation-settings: "CASL" 1, "MONO" 0; }
.top { display: flex; align-items: flex-end; justify-content: space-between; margin: 0 56px; padding: 40px 0 16px; border-bottom: 6px solid ${INK.ink}; }
.logo { font: 900 76px/0.8 "Big Shoulders Display"; text-shadow: 4px 3px 0 ${INK.pink}; }
.logo span { color: ${INK.blue}; text-shadow: none; }
.issue { display: flex; align-items: center; gap: 18px; font: 700 18px/1 "Recursive"; font-variation-settings: "CASL" 1, "MONO" 1; letter-spacing: 0.08em; text-transform: uppercase; }
.bar { display: flex; gap: 4px; } .bar i { width: 16px; height: 16px; }
.head { position: absolute; left: 56px; top: 176px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; font: 900 118px/0.8 "Big Shoulders Display"; text-transform: uppercase; }
.s { padding: 8px 16px 2px; }
.s1 { background: ${INK.ink}; color: ${INK.sheet}; transform: rotate(-2deg); }
.s2 { text-shadow: 6px 4px 0 ${INK.pink}; transform: rotate(0.8deg); padding-left: 6px; }
.s3 { background: ${INK.pink}; box-shadow: 6px 6px 0 ${INK.blue}; transform: rotate(-1.2deg); }
.who { position: absolute; left: 56px; bottom: 42px; font: 600 26px/1.3 "Recursive"; font-variation-settings: "CASL" 1, "MONO" 0; }
.who b { background: ${INK.yellow}; padding: 0 6px; }
.st { position: absolute; display: grid; place-items: center; align-content: center; text-align: center; font: 900 34px/0.9 "Big Shoulders Display"; text-transform: uppercase; filter: drop-shadow(0 2px 0 rgba(0,0,0,.12)) drop-shadow(0 10px 9px rgba(0,0,0,.28)); }
.st small { display: block; margin-top: 6px; font: 700 14px/1.1 "Recursive"; font-variation-settings: "MONO" 1; letter-spacing: 0.06em; }
.y { right: 250px; top: 196px; width: 170px; height: 170px; border-radius: 50%; background: ${INK.yellow}; transform: rotate(-7deg); }
.p { right: 70px; top: 230px; padding: 18px 22px; background: ${INK.pink}; font-size: 30px; transform: rotate(5deg); }
.k { right: 120px; top: 398px; padding: 18px 22px; background: ${INK.ink}; color: ${INK.yellow}; transform: rotate(-4deg); }
</style>
<div class="top"><div class="logo">ANAR<span>.TO</span></div><div class="issue"><span>Nº 01</span><span>Herbst 2026</span><span>Köln</span><span class="bar"><i style="background:${INK.pink}"></i><i style="background:${INK.blue}"></i><i style="background:${INK.yellow}"></i><i style="background:${INK.ink}"></i></span></div></div>
<div class="head"><span class="s s1">Don't take</span><span class="s s2">my word</span><span class="s s3">for it.</span></div>
<div class="st y">Expadu<small>live in Köln</small></div>
<div class="st p">Curiplay<small>in the oven</small></div>
<div class="st k">FocusGuard<small>brew install</small></div>
<p class="who"><b>Anar Hagverdiyev</b> · backend developer in Köln · press the buttons</p>`;

// The icon: an ink "A" on a yellow sticker. Small sizes drop the pink offset so the letter stays crisp.
const icon = (size) => `<!doctype html><meta charset="utf-8"><style>${FONTS}
html, body { margin: 0; }
body { width: ${size}px; height: ${size}px; display: grid; place-items: center; overflow: hidden; background: ${INK.yellow}; }
b { font: 900 ${Math.round(size * 0.92)}px/1 "Big Shoulders Display"; color: ${INK.ink}; transform: translateY(${(size * 0.035).toFixed(1)}px);
  ${size >= 64 ? `text-shadow: ${(size * 0.045).toFixed(1)}px ${(size * 0.035).toFixed(1)}px 0 ${INK.pink};` : ''} }
</style><b>A</b>`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'anar-meta-'));
const port = 9500 + Math.floor(Math.random() * 300);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });

async function render(html, w, h) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  const { result } = await send('Page.getFrameTree');
  await send('Page.setDocumentContent', { frameId: result.frameTree.frame.id, html });
  await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))', awaitPromise: true });
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
  return Buffer.from(shot.result.data, 'base64');
}

// A .ico that holds PNG images (supported by every current browser)
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(([size, png], i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, e); head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(png.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...pngs.map(([, png]) => png)]);
}

try {
  for (let i = 0; i < 60 && !ws; i++) {
    try {
      const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
      if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
    } catch {}
    if (!ws) await sleep(250);
  }
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
  await send('Page.enable');
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'og.png'), await render(og, 1200, 630));
  for (const [name, size] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]]) writeFileSync(join(OUT, name), await render(icon(size), size, size));
  const small = [];
  for (const size of [16, 32, 48]) small.push([size, await render(icon(size), size, size)]);
  writeFileSync(join(OUT, 'favicon.ico'), ico(small));
  console.log('wrote assets/meta: og.png, icon-512.png, icon-192.png, apple-touch-icon.png, favicon.ico');
} finally {
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
