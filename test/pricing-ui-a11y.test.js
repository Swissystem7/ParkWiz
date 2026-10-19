const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('parkPricingOverlay has region role and accessible label', () => {
  assert.match(html, /id="parkPricingOverlay"[^>]*onclick="closeParkPricing\(event\)"[^>]*role="region"[^>]*aria-label="תוכניות ומחירים"/);
});

test('park-pricing-box has dialog role, aria-modal, and aria-labelledby', () => {
  assert.match(html, /class="park-pricing-box"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="parkPricingTitle"/);
  assert.match(html, /id="parkPricingTitle"[^>]*>🅿️ ParkWiz Premium<\/div>/);
});

test('pricing modal includes accessible close button and accessible Free button', () => {
  assert.match(html, /<button type="button" class="pricing-close" id="pricingCloseBtn" onclick="closeParkPricing\(event\)" aria-label="סגור חלון תוכניות"/);
  assert.match(html, /<button type="button" class="btn btn-ghost" id="pricingFreeBtn"[^>]*onclick="closeParkPricing\(event\)">המשך עם Free<\/button>/);
});

test('premiumLockOverlay has region role and accessible label', () => {
  assert.match(html, /id="premiumLockOverlay"[^>]*onclick="closeLockModal\(event\)"[^>]*role="region"[^>]*aria-label="נעילת פרימיום"/);
});

test('premium-lock-box has dialog role, aria-modal, aria-labelledby, and close button', () => {
  assert.match(html, /class="premium-lock-box"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="premiumLockTitle"/);
  assert.match(html, /id="premiumLockTitle"[^>]*>הזמנה מראש זמינה ב-Premium בלבד<\/div>/);
  assert.match(html, /<button type="button" id="premiumLockCloseBtn" onclick="closeLockModal\(event\)" aria-label="סגור חלון נעילה"/);
});

test('closeParkPricing and closeLockModal guard against clicks inside the box', () => {
  assert.match(html, /function closeParkPricing\(e\)\s*\{[\s\S]*?!e\.target\.closest\('#pricingCloseBtn'\) && !e\.target\.closest\('#pricingFreeBtn'\)/);
  assert.match(html, /function closeLockModal\(e\)\s*\{[\s\S]*?!e\.target\.closest\('#premiumLockCloseBtn'\) && !e\.target\.closest\('\.btn-ghost'\)/);
});

test('escape key listener closes open pricing or lock overlays', () => {
  assert.match(html, /window\.addEventListener\('keydown',\s*\(e\)\s*=>\s*\{[\s\S]*?e\.key === 'Escape'[\s\S]*?closeParkPricing\(\)[\s\S]*?closeLockModal\(\)/);
});

test('activatePremium updates premium button text and aria-label', () => {
  assert.match(html, /premBtn\.setAttribute\('aria-label',\s*'ParkWiz Premium פעיל \(הדגמה\)'\)/);
});

// Pinned to exactly v18 when the pricing a11y pass landed, which made this
// file the one thing standing between the shell and its next bump: every other
// cache assertion in the suite is already a floor (test/contact.test.js,
// test/feedback-form.test.js, test/atidim-demo-page.test.js). What this test
// cares about is that the pricing bump happened at all, so make it a floor too
// and let later shell changes bump sw.js without editing a pricing test.
test('changed cached pages: the service worker cache is at v18 or later', () => {
  const v = Number((sw.match(/const CACHE = 'parkwiz-field-v(\d+)';/) || [])[1]);
  assert.ok(v >= 18, 'cache version ' + v + ' regressed below the pricing a11y bump');
});
