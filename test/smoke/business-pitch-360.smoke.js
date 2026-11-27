// PW-602: docs/business/pitch.html on a 360px phone viewport, offline.
// Fails on console errors, page errors, any outside request, or sideways overflow.
// Not part of `npm test`: run with `npm run test:smoke` after `npx playwright install chromium`.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  // Playwright is optional
}

test('pitch.html fits 360px without errors', { skip: !chromium && 'playwright not installed' }, async (t) => {
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    t.skip(`chromium not available: ${e.message.split('\n')[0]}`);
    return;
  }
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
    const problems = [];
    page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
    page.on('pageerror', (e) => problems.push(String(e)));
    await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : (problems.push(`outside request ${r.request().url()}`), r.abort())));
    const file = path.join(__dirname, '..', '..', 'docs', 'business', 'pitch.html');
    await page.goto(pathToFileURL(file).href);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `horizontal overflow ${overflow}px`);
    assert.equal(await page.locator('section.slide').count(), 10);
    assert.deepEqual(problems, []);
  } finally {
    await browser.close();
  }
});
