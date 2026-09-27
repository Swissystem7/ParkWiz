const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const offer = require('../src/lib/offer');

const root = path.join(__dirname, '..');

// The tender-exemption cap (תקנה 3(3)) is CPI-linked and moves every month on the 16th.
// A quote a municipal treasurer reads must never present an expired cap as current.

test('exemption cap carries machine-readable window dates', () => {
  assert.match(offer.EXEMPTION.windowStart, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(offer.EXEMPTION.windowEnd, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(offer.EXEMPTION.windowStart < offer.EXEMPTION.windowEnd);
  assert.equal(offer.EXEMPTION.official2026File, null);
});

test('exemptionStatus says whether the cap is current on a given date', () => {
  const inside = offer.exemptionStatus(offer.EXEMPTION.windowStart + 'T09:00:00.000Z');
  assert.equal(inside.current, true);
  assert.equal(inside.expired, false);
  const after = offer.exemptionStatus('2027-03-01T09:00:00.000Z');
  assert.equal(after.current, false);
  assert.equal(after.expired, true);
});

test('a quote generated after the window flags the cap as expired, in the data and in the text', () => {
  const q = offer.buildQuote({
    packageId: 'measure-after',
    amountIls: 48000,
    generatedAt: '2027-03-01T09:00:00.000Z',
  });
  assert.equal(q.exemption.capExpired, true);
  assert.equal(q.exemption.windowEnd, offer.EXEMPTION.windowEnd);
  const txt = offer.quoteToText(q);
  assert.match(txt, /פג תוקף/);
  assert.match(offer.quoteToCsv(q), /exemptionCapExpired,true/);
});

test('a quote generated inside the window uses the cap without an expiry warning', () => {
  const q = offer.buildQuote({
    packageId: 'measure-after',
    amountIls: 48000,
    generatedAt: offer.EXEMPTION.windowStart + 'T09:00:00.000Z',
  });
  assert.equal(q.exemption.capExpired, false);
  assert.equal(q.exemption.aboveCap, false);
  assert.doesNotMatch(offer.quoteToText(q), /פג תוקף/);
});

test('the offer page shows the same cap and window as the module (no stale copy in HTML)', () => {
  const html = fs.readFileSync(path.join(root, 'offer.html'), 'utf8');
  const cap = offer.formatIls(offer.EXEMPTION.thirdPartyIls).replace(' ₪', '');
  assert.match(html, new RegExp(cap.replace(/,/g, ',')));
  assert.ok(html.includes(offer.EXEMPTION.thirdPartyWindow), 'offer.html must show the current window');
  assert.doesNotMatch(html, /169,800/);
});
