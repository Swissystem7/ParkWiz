'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const commuteHtml = fs.readFileSync(path.join(root, 'demo', 'commute.html'), 'utf8');
const telAvivDoc = fs.readFileSync(path.join(root, 'docs', 'tel-aviv.md'), 'utf8');

test('demo/commute.html is an accessible Hebrew RTL page with design system tokens', () => {
  assert.match(commuteHtml, /lang="he"/);
  assert.match(commuteHtml, /dir="rtl"/);
  assert.match(commuteHtml, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(commuteHtml, /tokens\.css/);
  assert.match(commuteHtml, /theme\.js/);
  assert.match(commuteHtml, /role="region"/);
  assert.match(commuteHtml, /role="status"/);
  assert.match(commuteHtml, /aria-live="polite"/);
});

test('demo/commute.html models a phone with commuter notifications (only lot/spot/time)', () => {
  assert.match(commuteHtml, /phone-mockup/);
  assert.match(commuteHtml, /התפנה מקום/);
  assert.match(commuteHtml, /חניון עתידים/);
  assert.match(commuteHtml, /תא 14/);
  // Privacy rule: only lot, spot, time — no license plates, no identities
  assert.match(commuteHtml, /חניון · מקום · זמן בלבד/);
  assert.match(commuteHtml, /ללא LPR/);
});

test('demo/commute.html includes all 5 exit detection sources labeled with what works today', () => {
  assert.match(commuteHtml, /5 המקורות לזיהוי יציאה מחניה/);
  // Source 1: manual button
  assert.match(commuteHtml, /כפתור ידני/);
  assert.match(commuteHtml, /עובד היום \(פעיל\)/);
  // Source 2: security camera
  assert.match(commuteHtml, /מצלמת אבטחה/);
  assert.match(commuteHtml, /עובד היום \(פיילוט עתידים\)/);
  // Source 3: phone app
  assert.match(commuteHtml, /אפליקציה בטלפון/);
  assert.match(commuteHtml, /בפיתוח/);
  // Source 4: Bluetooth / CarPlay
  assert.match(commuteHtml, /Bluetooth \/ Apple CarPlay/);
  assert.match(commuteHtml, /תוכנן לשלב ב'/);
  // Source 5: Connected car API
  assert.match(commuteHtml, /API רכב מחובר/);
});

test('demo/commute.html inline scripts compile with zero syntax errors', () => {
  const scripts = [...commuteHtml.matchAll(/<script(?![^>]*src=)>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  assert.ok(scripts.length > 0, 'must have an inline script');
  for (const js of scripts) {
    assert.doesNotThrow(() => new vm.Script(js), 'commute.html script must compile cleanly');
  }
});

test('docs/tel-aviv.md covers Tel Aviv municipality, CityZone, and smart parking pilot', () => {
  assert.match(telAvivDoc, /עיריית תל אביב-יפו/);
  assert.match(telAvivDoc, /CityZone/);
  assert.match(telAvivDoc, /פארק עתידים/);
  assert.match(telAvivDoc, /09:00 ל-14:00/);
  assert.match(telAvivDoc, /No LPR/);
  assert.match(telAvivDoc, /ללא זיהוי לוחיות רישוי/);
  assert.match(telAvivDoc, /5 המקורות לזיהוי יציאה/);
  assert.match(telAvivDoc, /4 שבועות ללא עלות/);
});
