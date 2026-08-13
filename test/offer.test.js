const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const offer = require('../src/lib/offer');

test('formats shekels and rejects a fake official 2026 exemption file', () => {
  assert.equal(offer.formatIls(169800), '169,800 ₪');
  assert.equal(offer.formatIls(0), '0 ₪');
  assert.equal(offer.formatIls(null), '—');
  assert.equal(offer.EXEMPTION.baseIls, 26000);
  assert.equal(offer.EXEMPTION.thirdPartyIls, 169800);
  assert.equal(offer.EXEMPTION.official2026File, null);
  assert.equal(offer.aboveExemption(169800), true);
  assert.equal(offer.aboveExemption(48000), false);
});

test('builds a mailto and a wa.me link without sending', () => {
  const out = offer.buildOutreach({
    senderName: 'אבירן סוויסה',
    senderPhone: '0500000000',
    senderEmail: 'aviran@example.com',
    recipientName: 'דנה',
    recipientEmail: 'dana@example.com',
    channel: 'email',
    cameraStreet: 'הרצל',
  });
  assert.equal(out.ok, true);
  assert.equal(out.sent, false);
  assert.match(out.subject, /פיילוט טכני חינם/);
  assert.match(out.body, /תפוס \/ פנוי/);
  assert.match(out.body, /הרצל/);
  assert.doesNotMatch(out.body, /הכנסות מקנסות|ROI מובטח|לקוחות משלמים שלנו/);
  assert.match(out.emailHref, /^mailto:dana@example\.com\?/);
  assert.match(out.emailHref, /subject=/);
  const wa = offer.whatsappHref('0526333106', 'שלום');
  assert.equal(wa, 'https://wa.me/972526333106?text=' + encodeURIComponent('שלום'));
});

test('booking validation requires a real recipient channel', () => {
  const bad = offer.buildOutreach({ channel: 'email', senderName: 'אבירן' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => /מייל/.test(e)));
  const waBad = offer.validateBook({ channel: 'whatsapp', senderPhone: '0501', recipientPhone: '' });
  assert.equal(waBad.ok, true);
  assert.equal(waBad.fields.recipientPhone, offer.BUYER.whatsapp);
});

test('free-pilot quote is 0 ₪ and a paid quote refuses to invent a market price', () => {
  const free = offer.buildQuote({
    packageId: 'pilot-free',
    generatedAt: '2026-08-13T12:00:00.000Z',
    authority: 'עיריית נתניה',
  });
  assert.equal(free.ok, true);
  assert.equal(free.amountIls, 0);
  assert.equal(free.realOffer, true);
  assert.equal(free.sent, false);
  assert.match(free.payment, /אין סליקה/);
  assert.equal(free.noRoi, true);
  assert.equal(free.noCustomers, true);
  assert.equal(free.id, 'PW-20260813-' + offer.quoteId('2026-08-13T12:00:00.000Z', 'עיריית נתניה').slice(-4));

  const paidEmpty = offer.buildQuote({ packageId: 'measure-after', amountIls: '' });
  assert.equal(paidEmpty.ok, false);
  assert.ok(paidEmpty.errors.some((e) => /אין מחירון שוק/.test(e)));

  const paid = offer.buildQuote({
    packageId: 'measure-after',
    amountIls: 24000,
    cameras: 1,
    durationDays: 90,
    generatedAt: '2026-08-13T12:00:00.000Z',
  });
  assert.equal(paid.ok, true);
  assert.equal(paid.realOffer, false);
  assert.equal(paid.exemption.aboveCap, false);
  assert.match(offer.quoteToText(paid), /24,000 ₪/);
  assert.match(offer.quoteToCsv(paid), /amountIls,24000/);
});

test('offer page is Hebrew RTL, honest, and wired into nav', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'offer.html'), 'utf8');
  const nav = fs.readFileSync(path.join(root, 'src', 'lib', 'surface-nav.js'), 'utf8');
  const doc = fs.readFileSync(path.join(root, 'MONETIZATION.md'), 'utf8');
  assert.match(html, /lang="he"/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /class="banner"/);
  assert.match(html, /הזמן פיילוט/);
  assert.match(html, /אין סליקה|לא נשלח אוטומטית/);
  assert.doesNotMatch(html, /unpkg|cdnjs|googleapis/i);
  assert.doesNotMatch(html, /לקוחות מרוצים|החזר השקעה מובטח|Stripe|PayPal/i);
  assert.match(nav, /offer\.html/);
  assert.match(doc, /# ParkWiz — מחקר מונטיזציה/);
  assert.match(doc, /לא נמצא מקור/);
  assert.match(doc, /169,800/);
  assert.match(doc, /תקנה 3\(3\)/);
});
