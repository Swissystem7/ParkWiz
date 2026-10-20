// Headless smoke test of the buyer-facing pages next to the map (the parking
// marketplace and the municipal offer) on a 390px phone viewport. Same offline
// harness and checks as index-390.smoke.js: Hebrew RTL, no console or page
// errors, no failed local requests, no outside requests, no sideways overflow.
// Run with `npm run test:smoke` after `npx playwright install chromium`.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { WIDTH, serve, openPage, overflowing } = require('./harness');

const PAGES = ['marketplace.html', 'offer.html'];

let server;
let base;
let browser;
test.before(async () => {
  server = await serve();
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch();
});
test.after(async () => {
  if (browser) await browser.close();
  if (server) server.close();
});

for (const name of PAGES) {
  test(`${name} loads at 390px: Hebrew RTL, no errors, nothing off-screen`, async () => {
    const { context, page, errors, external } = await openPage(browser, base, { page: name, leaflet: false, settleMs: 500 });
    try {
      assert.deepEqual(errors, [], 'console / page errors:\n' + errors.join('\n'));
      assert.deepEqual(external, [], 'page reached outside the local server');
      assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
      assert.equal(await page.getAttribute('html', 'lang'), 'he');
      // A missing viewport meta lays the page out at 980px and scales it down.
      assert.equal(await page.evaluate(() => window.innerWidth), WIDTH, 'layout width is not the phone width');
      const { scrollWidth, out } = await overflowing(page);
      assert.deepEqual(out, [], 'elements outside the viewport:\n' + out.join('\n'));
      assert.ok(scrollWidth <= WIDTH, `page scrolls sideways: scrollWidth ${scrollWidth} > ${WIDTH}`);
    } finally {
      await context.close();
    }
  });
}
