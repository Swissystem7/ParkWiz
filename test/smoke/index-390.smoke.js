// Headless smoke test of the main page (index.html) on a 390px phone viewport.
// Runs offline through ./harness. Fails on console errors, uncaught page
// errors, failed local requests and anything that overflows the viewport sideways.
// Not part of `npm test` (needs a browser): run with `npm run test:smoke`
// after `npx playwright install chromium`.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { WIDTH, serve, openPage, overflowing } = require('./harness');

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

test('main page loads at 390px with no console errors and no outside requests', async () => {
  const { context, page, errors, external } = await openPage(browser, base);
  try {
    assert.deepEqual(errors, [], 'console / page errors:\n' + errors.join('\n'));
    assert.deepEqual(external, [], 'page reached outside the local server');
    assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
    assert.equal(await page.getAttribute('html', 'lang'), 'he');
    assert.ok(await page.locator('.leaflet-container').count() > 0, 'the map must mount');
  } finally {
    await context.close();
  }
});

test('nothing overflows the 390px viewport sideways (RTL layout)', async () => {
  const { context, page } = await openPage(browser, base);
  try {
    const { scrollWidth, out } = await overflowing(page);
    assert.deepEqual(out, [], 'elements outside the viewport:\n' + out.join('\n'));
    assert.ok(scrollWidth <= WIDTH, `page scrolls sideways: scrollWidth ${scrollWidth} > ${WIDTH}`);
    // The map is the product: the nav and banners above it must leave it room.
    const mapHeight = await page.locator('.map-wrap').evaluate((el) => el.getBoundingClientRect().height);
    assert.ok(mapHeight >= 844 * 0.4, `map squeezed to ${Math.round(mapHeight)}px of 844px`);
    const navHeight = await page.locator('#pwSurfaceNav').evaluate((el) => el.getBoundingClientRect().height);
    assert.ok(navHeight <= 60, `top nav wraps to ${Math.round(navHeight)}px tall`);
    // The legend starts collapsed on a phone so it does not cover the map.
    assert.equal(await page.locator('#mapLegend').evaluate((el) => el.open), false);
  } finally {
    await context.close();
  }
});
