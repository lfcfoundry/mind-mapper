// Picture gate: screenshots of fixed states, compared to per-browser baselines at 99.5% matching pixels.
// Usage: CHROMIUM=... FIREFOX=... node scripts/picture-gate.mjs [chromium|firefox ...] [--update]
// Needs puppeteer-core on NODE_PATH. Baselines are per browser AND per machine font setup (system-ui differs), so refresh them with --update on the machine that runs the gate.
import { createRequire } from 'node:module';
const puppeteer = createRequire(import.meta.url)('puppeteer-core'); // CommonJS lookup honors NODE_PATH
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2), update = args.includes('--update');
const browsers = args.filter((a) => !a.startsWith('--')); if (!browsers.length) browsers.push('chromium', 'firefox');
const THRESHOLD = 0.995;
const nodes = [{ id: 'r', parentId: null, order: 0, label: 'Plan the trip' }];
['Flights', 'Hotel', 'Food', 'Packing'].forEach((l, i) => nodes.push({ id: 'a' + i, parentId: 'r', order: i, label: l }));
['Compare prices', 'Book early'].forEach((l, i) => nodes.push({ id: 'b' + i, parentId: 'a0', order: i, label: l }));
nodes.push({ id: 'c0', parentId: 'a3', order: 0, label: 'A longer label that has to wrap onto a second line' });
const sample = JSON.stringify({ format: 'lfcfoundry.mindmap', schemaVersion: 1, document: { id: 'd', title: 'Trip', rootId: 'r', nodes, relationships: [] } });
const states = [
  ['desktop-map', 1280, 800, async () => {}],
  ['phone-map', 390, 800, async () => {}],
  ['desktop-file-menu', 1280, 800, async (p) => { await p.click('#file-menu summary'); }],
  ['desktop-editing', 1280, 800, async (p) => { await p.keyboard.press('Enter'); }],
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function shot(browser, name, width, height, act) {
  const page = await browser.newPage(); await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto('file://' + root + 'dist/mind-mapper.html');
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto('file://' + root + 'dist/mind-mapper.html');
  await page.evaluate((txt) => { const dt = new DataTransfer(); dt.items.add(new File([txt], 'trip.json')); const i = document.getElementById('file'); i.files = dt.files; i.dispatchEvent(new Event('change')); }, sample);
  await page.waitForFunction(() => /Opened/.test(document.getElementById('app-status').textContent), { timeout: 10000 });
  await page.evaluate(() => { document.getElementById('app-status').textContent = 'Ready'; document.getElementById('save-note').textContent = ''; });
  await act(page); await sleep(300);
  const png = Buffer.from(await page.screenshot({ type: 'png', encoding: 'base64' }), 'base64'); await page.close(); return png;
}
async function match(page, a, b) {
  return page.evaluate(async (x, y) => {
    const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ib] = await Promise.all([load(x), load(y)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return -1;
    const px = (i) => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
    const da = px(ia), db = px(ib); let same = 0; const n = da.length / 4;
    for (let k = 0; k < da.length; k += 4) if (Math.abs(da[k] - db[k]) + Math.abs(da[k + 1] - db[k + 1]) + Math.abs(da[k + 2] - db[k + 2]) <= 6) same++;
    return same / n;
  }, a.toString('base64'), b.toString('base64'));
}
let failed = false;
for (const name of browsers) {
  const launch = name === 'firefox' ? { browser: 'firefox', executablePath: process.env.FIREFOX, headless: true, protocol: 'webDriverBiDi' }
    : { executablePath: process.env.CHROMIUM, headless: true, args: ['--no-sandbox'] };
  const browser = await puppeteer.launch(launch); console.log(name, await browser.version());
  const judge = await browser.newPage(); await judge.goto('about:blank');
  for (const [state, w, h, act] of states) {
    const dir = `${root}test/picture/${name}`; const file = `${dir}/${state}.png`;
    const png = await shot(browser, state, w, h, act);
    if (update || !existsSync(file)) { mkdirSync(dir, { recursive: true }); writeFileSync(file, png); console.log('  baseline written', state); continue; }
    const m = await match(judge, readFileSync(file), png);
    const ok = m >= THRESHOLD; if (!ok) failed = true;
    console.log(`  ${state}: ${(m * 100).toFixed(2)}% ${ok ? 'pass' : 'FAIL'}`);
    if (!ok) writeFileSync(`${dir}/${state}.actual.png`, png);
  }
  await browser.close();
}
process.exit(failed ? 1 : 0);
