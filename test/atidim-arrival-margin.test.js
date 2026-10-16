// Waze-style arrival margin (#201) — the window math behind the "מרווח הגעה"
// line on demo/atidim.html. #201 landed the model with two smoke assertions and
// left the rest to #202, which is this file: the window has to be a real window
// (symmetric, whole 5-minute steps, wrapping midnight), it has to widen exactly
// where a single prediction is weakest, and the free-bay claim across it has to
// stay a range. The copy guard lives in test/margin-certainty-copy.test.js, and
// src/lib/margin.js — the operator board's richer margin — in test/margin.test.js.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const lot = require('../src/lib/atidim-lot');

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const CURVE = lot.getHourlyCurve();
const CAPACITY = lot.ATIDIM_LOT.totalCapacity;
const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

test('every hour of the day gets a symmetric window in whole 5-minute steps', () => {
  for (const h of HOURS) {
    const m = lot.computeArrivalMargin(h);
    assert.equal(m.hour, h);
    assert.equal(m.label, CURVE[h].label);
    assert.equal(m.marginMinutes % 5, 0, 'hour ' + h + ' margin ' + m.marginMinutes);
    assert.ok(m.marginMinutes >= 5 && m.marginMinutes <= 30, 'hour ' + h + ' margin ' + m.marginMinutes);
    // Parsed back out of the labels, so a formatting slip cannot hide a lopsided
    // window — and so the midnight wrap is checked as a clock, not as arithmetic.
    assert.match(m.from, /^([01]\d|2[0-3]):[0-5]\d$/, m.from);
    assert.match(m.to, /^([01]\d|2[0-3]):[0-5]\d$/, m.to);
    assert.equal((toMinutes(m.from) + m.marginMinutes) % 1440, h * 60, 'hour ' + h + ' opens at ' + m.from);
    assert.equal(toMinutes(m.to), (h * 60 + m.marginMinutes) % 1440, 'hour ' + h + ' closes at ' + m.to);
  }
  // The two wrapping hours spelled out, since that is where an off-by-one reads
  // as a window in yesterday or tomorrow.
  assert.deepEqual([lot.computeArrivalMargin(0).from, lot.computeArrivalMargin(0).to], ['23:55', '00:05']);
  assert.deepEqual([lot.computeArrivalMargin(23).from, lot.computeArrivalMargin(23).to], ['22:55', '23:05']);
});

test('the window widens where the curve moves fastest and where the lot runs full', () => {
  const margins = HOURS.map((h) => lot.computeArrivalMargin(h).marginMinutes);
  const swingAt = (h) => Math.max(
    Math.abs(lot.HOURLY_RATES[h] - lot.HOURLY_RATES[(h + 23) % 24]),
    Math.abs(lot.HOURLY_RATES[(h + 1) % 24] - lot.HOURLY_RATES[h]),
  );
  // The morning arrival wave (0.42 → 0.76 → 0.89) is the hour a point
  // prediction is most likely to be wrong, so it earns the widest window.
  assert.equal(margins.indexOf(Math.max(...margins)), 8);
  assert.equal(swingAt(8), Math.max(...HOURS.map(swingAt)));
  // The flat small hours sit on the floor.
  assert.equal(Math.min(...margins), 5);
  assert.deepEqual([margins[2], margins[3]], [5, 5]);
  // Fullness widens the window on its own: 20:00 moves slightly faster than
  // 10:00, yet 10:00 is the harder prediction because the lot is near capacity.
  assert.ok(swingAt(20) > swingAt(10), 'the evening drain is the steeper stretch');
  assert.ok(CURVE[10].isPeak && !CURVE[20].isPeak);
  assert.ok(margins[10] > margins[20], 'a near-full lot is the harder call even on a flat stretch');
});

test('the free-bay claim is a range across the window, not the count at the hour mark', () => {
  const m = lot.computeArrivalMargin(8);
  assert.deepEqual([m.from, m.to, m.marginMinutes], ['07:35', '08:25', 25]);
  // 08:00 holds ~53 free bays, but the window opens near 85 and closes near 40.
  // Quoting the 53 alone is the promise the margin exists to replace.
  assert.equal(m.expectedAvailable, CURVE[8].available);
  assert.ok(m.expectedLow < m.expectedAvailable && m.expectedAvailable < m.expectedHigh, JSON.stringify(m));
  assert.equal(m.expectedLow, Math.floor(lot.availableAtMinute(toMinutes('08:25'))));
  assert.equal(m.expectedHigh, Math.ceil(lot.availableAtMinute(toMinutes('07:35'))));
  assert.match(m.textHe, /צפויים 40–85 מקומות פנויים/);
  for (const h of HOURS) {
    const w = lot.computeArrivalMargin(h);
    assert.ok(w.expectedLow <= w.expectedAvailable, 'hour ' + h + ': ' + JSON.stringify(w));
    assert.ok(w.expectedAvailable <= w.expectedHigh, 'hour ' + h + ': ' + JSON.stringify(w));
    assert.ok(w.expectedLow >= 0 && w.expectedHigh <= CAPACITY, 'hour ' + h + ': ' + JSON.stringify(w));
  }
});

test('free bays are read between the hours, and the reading wraps past midnight', () => {
  assert.equal(lot.availableAtMinute(8 * 60), CURVE[8].available);
  // One point per hour would make a ±15-minute window flat: a point prediction
  // wearing a window's clothes.
  assert.equal(lot.availableAtMinute(8 * 60 + 30), (CURVE[8].available + CURVE[9].available) / 2);
  assert.equal(lot.availableAtMinute(23 * 60 + 30), (CURVE[23].available + CURVE[0].available) / 2);
  // Wraps instead of running off the end of the curve; a bad clock reads 00:00.
  assert.equal(lot.availableAtMinute(1440), CURVE[0].available);
  assert.equal(lot.availableAtMinute(-30), lot.availableAtMinute(1410));
  assert.equal(lot.availableAtMinute('nope'), CURVE[0].available);
  for (let m = 0; m < 1440; m += 7) {
    const free = lot.availableAtMinute(m);
    assert.ok(Number.isFinite(free) && free >= 0 && free <= CAPACITY, 'minute ' + m + ': ' + free);
  }
});

test('a silly hour or capacity still answers with a window, never with undefined', () => {
  assert.equal(lot.computeArrivalMargin('bad').hour, 0);
  assert.equal(lot.computeArrivalMargin(undefined).hour, 0);
  assert.equal(lot.computeArrivalMargin(25).hour, 1);
  assert.equal(lot.computeArrivalMargin(-1).hour, 23);
  assert.equal(lot.computeArrivalMargin(8.7).hour, 8, 'a fractional hour floors, it does not round up');
  // A capacity of zero or of nonsense falls back to the real lot rather than
  // reporting a lot with no bays in it at all.
  assert.deepEqual(lot.computeArrivalMargin(10, 0), lot.computeArrivalMargin(10));
  assert.deepEqual(lot.computeArrivalMargin(10, 'x'), lot.computeArrivalMargin(10));
  // A single camera zone is small enough to genuinely run out, and then the copy
  // says so instead of rounding up to "about 1 מקומות פנויים".
  const tiny = lot.computeArrivalMargin(10, 12);
  assert.deepEqual([tiny.expectedLow, tiny.expectedHigh], [1, 1]);
  assert.match(tiny.textHe, /צפוי מקום פנוי אחד בלבד/);
  const full = lot.computeArrivalMargin(10, 3);
  assert.deepEqual([full.expectedLow, full.expectedHigh], [0, 0]);
  assert.match(full.textHe, /החיזוי לא מראה מקומות פנויים בחלון הזה/);
  // Same hour, same window — the demo screenshot in a pitch stays reproducible.
  assert.deepEqual(lot.computeArrivalMargin(8), lot.computeArrivalMargin(8));
});

// #202: pin the window math for every hour of the day, not just two samples.
const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

test('every hour gets a ±N window on a 5-minute grid, clamped to 5..30', () => {
  for (let hour = 0; hour < 24; hour++) {
    const m = lot.computeArrivalMargin(hour);
    assert.equal(m.hour, hour);
    assert.equal(m.label, lot.hourlyPoint(hour).label);
    assert.equal(m.marginMinutes % 5, 0, 'hour ' + hour);
    assert.ok(m.marginMinutes >= 5 && m.marginMinutes <= 30, 'hour ' + hour + ': ' + m.marginMinutes);
    // from/to sit exactly marginMinutes either side of the hour, across midnight too.
    assert.equal((toMin(m.from) + m.marginMinutes) % 1440, hour * 60, 'from ' + m.from);
    assert.equal((toMin(m.to) - m.marginMinutes + 1440) % 1440, hour * 60, 'to ' + m.to);
  }
});

test('the window grows where the curve swings and where the lot is near full', () => {
  // Morning wave (07-09) and peak hours outrank the flat small hours.
  for (const busy of [8, 10, 12]) {
    for (const quiet of [2, 3, 4]) {
      assert.ok(lot.computeArrivalMargin(busy).marginMinutes > lot.computeArrivalMargin(quiet).marginMinutes,
        busy + ' vs ' + quiet);
    }
  }
  // Same hour, same margin: the window is a property of the curve, not of capacity.
  assert.equal(lot.computeArrivalMargin(10, 50).marginMinutes, lot.computeArrivalMargin(10).marginMinutes);
});

test('hours wrap like hourlyPoint, and expected bays follow capacity', () => {
  assert.deepEqual(lot.computeArrivalMargin(24), lot.computeArrivalMargin(0));
  assert.deepEqual(lot.computeArrivalMargin(-1), lot.computeArrivalMargin(23));
  assert.equal(lot.computeArrivalMargin(NaN).hour, 0);
  assert.equal(lot.computeArrivalMargin(10).expectedAvailable, lot.hourlyPoint(10).available);
  assert.equal(lot.computeArrivalMargin(10, 100).expectedAvailable, lot.hourlyPoint(10, 100).available);
});

test('margin copy is a window plus a prediction tone at every hour, never a promise', () => {
  for (let hour = 0; hour < 24; hour++) {
    const m = lot.computeArrivalMargin(hour);
    assert.ok(m.textHe.includes(m.from + '–' + m.to), m.textHe);
    assert.ok(m.textHe.includes('±' + m.marginMinutes), m.textHe);
    assert.match(m.textHe, /(?:כ-\d+|\d+–\d+) מקומות/, 'bays are approximate: ' + m.textHe);
    assert.match(m.textHe, /חיזוי, לא הבטחה\.$/);
    assert.doesNotMatch(m.textHe, /מובטח|מבטיח|בוודאות|שמור לך|בטוח/, m.textHe);
  }
});

test('the demo pages render the margin through the prediction-tone copy', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const demo = (f) => fs.readFileSync(path.join(__dirname, '..', 'demo', f), 'utf8');
  const atidim = demo('atidim.html');
  // The hint is filled from computeArrivalMargin().textHe, which carries the tone.
  assert.match(atidim, /id="arrivalMargin"/);
  assert.match(atidim, /computeArrivalMargin\(.*\)\.textHe/);
  const board = demo('atidim-board.html');
  assert.match(board, /\$\("marginTone"\)\.textContent = m\.tone/);
  for (const html of [atidim, board]) {
    assert.doesNotMatch(html, /מקום מובטח|מקום בטוח|שומר לך מקום|בוודאות תמצא/);
  }
});
