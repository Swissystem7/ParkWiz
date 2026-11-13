// ParkWiz task 345: mobile 390px end-to-end checks for the driver and board pages.
// Run: node --test test/e2e/mobile-390.e2e.mjs
// Not part of `npm test` (that glob is test/*.js), so the unit suite is unchanged.
// No external network: every request that is not to the local server is aborted.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGES = ['demo/commute.html', 'demo/atidim-board.html', 'live-assign.html'];
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.geojson': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp'
};
// Plate-like strings and media fields must never reach the page or its data.
const PLATE = /\b\d{2,3}-\d{2,3}-\d{2,3}\b/;
const MEDIA_KEYS = /"(plate|licen[cs]e_?plate|image|frame|video|snapshot|thumbnail)"\s*:/i;

let server, browser, origin;

before(async () => {
  server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch();
});

after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise((r) => server.close(r));
});

async function open(rel) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  const blocked = [];
  const bodies = [];
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(origin) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    blocked.push(u);
    return route.abort();
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    // A blocked external request logs "Failed to load resource"; that is the test's own doing.
    if (m.type() === 'error' && !/Failed to load resource|net::ERR_FAILED/.test(m.text())) errors.push('console: ' + m.text());
  });
  page.on('response', async (r) => {
    if (/\.json(\?|$)/.test(r.url())) { try { bodies.push(await r.text()); } catch (e) { /* ignore */ } }
  });
  const res = await page.goto(origin + '/' + rel, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  return { ctx, page, errors, blocked, bodies, status: res.status() };
}

for (const rel of PAGES) {
  test(rel + ' at 390px: loads, no script errors, no horizontal overflow', async () => {
    const { ctx, page, errors, blocked, status } = await open(rel);
    try {
      assert.equal(status, 200);
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth, iw: window.innerWidth,
        text: document.body.innerText.trim().length
      }));
      console.log('MEASURE ' + rel + ' scrollWidth=' + m.sw + ' innerWidth=' + m.iw + ' textLen=' + m.text + ' externalBlocked=' + blocked.length);
      assert.ok(m.text > 0, 'page rendered no text');
      assert.deepEqual(errors, [], 'script errors on ' + rel);
      assert.ok(m.sw <= m.iw + 1, 'horizontal overflow: scrollWidth ' + m.sw + ' > ' + m.iw);
    } finally { await ctx.close(); }
  });

  test(rel + ' at 390px: no plate-like string and no media field in page or JSON', async () => {
    const { ctx, page, bodies } = await open(rel);
    try {
      const text = await page.evaluate(() => document.body.innerText);
      assert.ok(!PLATE.test(text), 'plate-like string in page text');
      for (const b of bodies) {
        assert.ok(!MEDIA_KEYS.test(b), 'media or plate field in a JSON response');
      }
    } finally { await ctx.close(); }
  });
}

test('demo/atidim-board.html at 390px: the time slider moves without a crash', async () => {
  const { ctx, page, errors } = await open('demo/atidim-board.html');
  try {
    const sliders = await page.locator('input[type=range]').count();
    console.log('MEASURE atidim-board sliders=' + sliders);
    assert.ok(sliders >= 1, 'no time slider found');
    const before = await page.evaluate(() => document.body.innerText);
    const steps = await page.evaluate(() => {
      const s = document.querySelector('input[type=range]');
      const min = Number(s.min || 0), max = Number(s.max || 100);
      const out = [];
      [min, Math.round((min + max) / 2), max].forEach((v) => {
        s.value = String(v);
        s.dispatchEvent(new Event('input', { bubbles: true }));
        s.dispatchEvent(new Event('change', { bubbles: true }));
        out.push({ v: v, text: document.body.innerText.length });
      });
      return { min: min, max: max, out: out };
    });
    console.log('MEASURE atidim-board slider ' + JSON.stringify(steps));
    await page.waitForTimeout(300);
    assert.deepEqual(errors, [], 'script errors while moving the slider');
    const afterText = await page.evaluate(() => document.body.innerText);
    assert.ok(afterText.trim().length > 0, 'page empty after moving the slider');
    assert.ok(steps.max > steps.min, 'slider has no range');
    assert.ok(before.length > 0);
  } finally { await ctx.close(); }
});
