// Headless smoke of demo/results-calculator.html at 360px (research-03): no
// number before input; alert counts give precision / missed / shown-free-but-taken. Offline:
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

test('results calculator: alert result only after input at 360px', { skip: !chromium && 'playwright not installed' }, async () => {
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
    await page.goto(base + '/demo/results-calculator.html');
    await page.click('#aCalc');
    assert.match(await page.textContent('#aOut'), /אין תוצאה/);
    await page.fill('#aChecked', '200');
    await page.fill('#aCorrect', '197');
    await page.fill('#aMissed', '13');
    await page.click('#aCalc');
    const out = await page.textContent('#aOut');
    assert.match(out, /98\.5%/);
    assert.match(out, /הוצג פנוי אך תפוס: 3/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, 'horizontal overflow ' + overflow + 'px');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});
