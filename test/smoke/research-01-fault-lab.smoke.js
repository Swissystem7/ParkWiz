// Headless smoke of demo/fault-lab.html at 360px (research-01): a fault turns
// the spot unknown and hides the driver alert; reset brings it back. Offline:
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

test('fault lab: unknown state hides the alert at 360px', { skip: !chromium && 'playwright not installed' }, async () => {
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
    await page.goto(base + '/demo/fault-lab.html');
    await page.click('[data-fault="ראות חסומה"]');
    assert.equal(await page.textContent('#spot'), 'מקום A1: לא ידוע');
    assert.equal(await page.getAttribute('#alertBox', 'data-state'), 'hidden');
    assert.match(await page.textContent('#ops'), /צריך לבדוק/);
    await page.click('#reset');
    assert.equal(await page.getAttribute('#alertBox', 'data-state'), 'shown');
    assert.match(await page.textContent('#stamp'), /עודכן לפני/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, 'horizontal overflow ' + overflow + 'px');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});
