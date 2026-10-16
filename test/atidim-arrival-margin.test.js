// Waze-style arrival margin (#201): a window around the planned arrival, never
// a single promised minute. Fuller coverage is tracked in #202.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const lot = require('../src/lib/atidim-lot');

test('margin is a symmetric window, wider at the morning rush than at night', () => {
  const rush = lot.computeArrivalMargin(8);
  const night = lot.computeArrivalMargin(3);
  assert.ok(rush.marginMinutes > night.marginMinutes);
  assert.equal(rush.from, '07:' + String(60 - rush.marginMinutes).padStart(2, '0'));
  assert.equal(night.marginMinutes % 5, 0);
  assert.ok(night.marginMinutes >= 5 && rush.marginMinutes <= 30);
});

test('window wraps midnight and the copy never claims certainty', () => {
  const m = lot.computeArrivalMargin(0);
  assert.match(m.from, /^23:\d\d$/);
  assert.match(m.textHe, /חיזוי, לא הבטחה/);
  assert.equal(lot.computeArrivalMargin('bad').hour, 0);
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
    assert.match(m.textHe, /כ-\d+ מקומות/, 'bays are approximate: ' + m.textHe);
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
