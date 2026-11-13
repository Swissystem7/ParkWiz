// Headless smoke of demo/meeting-ops.html at 360px (research-07): the trial end
// checklist reports complete only when every item is checked. Offline:
// any non-local request fails the test. Run with `npm run test:smoke`.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { /* optional */ }
const root = path.join(__dirname, '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

test('trial end: complete only when all items are checked at 360px', { skip: !chromium && 'playwright not installed' }, async () => {
  const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 780 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : (errors.push('external ' + r.request().url()), r.abort())));
    await page.goto(base + '/demo/meeting-ops.html');
    assert.match(await page.textContent('#endStatus'), /סומנו 0 מתוך 7/);
    const boxes = page.locator('#endList input[type=checkbox]');
    for (let k = 0; k < 7; k++) await boxes.nth(k).check();
    assert.match(await page.textContent('#endStatus'), /הסגירה הושלמה/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, 'horizontal overflow ' + overflow + 'px');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});
