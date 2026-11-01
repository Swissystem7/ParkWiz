'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pilotMd = fs.readFileSync(path.join(root, 'docs', 'pilot.md'), 'utf8');

test('docs/pilot.md covers the meeting stakeholders and context', () => {
  assert.match(pilotMd, /רוני נדלר/);
  assert.match(pilotMd, /פארק עתידים/);
  assert.match(pilotMd, /CityZone/);
  assert.match(pilotMd, /יואב מילוא/);
  assert.match(pilotMd, /ParkWiz/);
});

test('docs/pilot.md specifies requirements from Atidim: existing camera stream & contact', () => {
  assert.match(pilotMd, /מצלמת אבטחה אחת קיימת|מצלמה אחת קיימת/);
  assert.match(pilotMd, /RTSP|ONVIF/);
  assert.match(pilotMd, /איש קשר/);
  assert.match(pilotMd, /אין צורך ברכש או התקנת מצלמות חדשות|אין צורך להתקין מצלמה חדשה/);
});

test('docs/pilot.md defines the 4-week pilot and success metrics', () => {
  assert.match(pilotMd, /4 שבועות/);
  assert.match(pilotMd, /0 ₪/);
  assert.match(pilotMd, /שבוע 1/);
  assert.match(pilotMd, /שבועות 2–3/);
  assert.match(pilotMd, /שבוע 4/);
  assert.match(pilotMd, /דיוק ספירה מול בדיקה ידנית/);
});

test('docs/pilot.md emphasizes privacy by design and no fabrication', () => {
  assert.match(pilotMd, /No LPR/);
  assert.match(pilotMd, /לוחיות רישוי/);
  assert.match(pilotMd, /זיהוי פנים/);
  assert.match(pilotMd, /וידאו אינו נשמר|הווידאו אינו נשמר/);
  assert.match(pilotMd, /אין במערכת נתונים מומצאים|בלי להמציא/);
});
