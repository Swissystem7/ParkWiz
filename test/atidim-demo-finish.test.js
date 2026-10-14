// Meeting-readiness guards for the Park Atidim operator demo (Refs #136,
// continuing #120 / #121 / #123). These cover the parts that only break in
// front of a customer: a clock in the wrong time zone, counters that contradict
// the hourly chart, a camera switch that changes nothing, and a canvas that
// blanks out on an older iPad.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const lot = require('../src/lib/atidim-lot');

const root = path.join(__dirname, '..');
const demoHtml = fs.readFileSync(path.join(root, 'demo', 'atidim.html'), 'utf8');

// 18.10.2026 06:30 UTC is 09:30 in Tel Aviv (IDT, UTC+3 — DST ends 25.10).
const MEETING_INSTANT = new Date('2026-10-18T06:30:00Z');

function hasJerusalemTimeZone() {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', hour12: false });
    return fmt.format(MEETING_INSTANT).includes('09');
  } catch (err) {
    return false;
  }
}

test('formatLotClock reads the lot wall clock, not UTC', () => {
  assert.match(lot.formatLotClock(MEETING_INSTANT), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  if (!hasJerusalemTimeZone()) return; // runtime without IANA data falls back to host time
  assert.equal(lot.formatLotClock(MEETING_INSTANT), '2026-10-18 09:30:00');
  assert.equal(lot.lotHour(MEETING_INSTANT), 9);
});

test('formatLotClock and lotHour survive a missing or invalid date', () => {
  assert.match(lot.formatLotClock(undefined), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.match(lot.formatLotClock(new Date('nope')), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  const hour = lot.lotHour(new Date('nope'));
  assert.ok(Number.isInteger(hour) && hour >= 0 && hour <= 23);
});

test('hourlyPoint wraps hours and never returns undefined', () => {
  assert.equal(lot.hourlyPoint(9).label, '09:00');
  assert.equal(lot.hourlyPoint(24).hour, 0);
  assert.equal(lot.hourlyPoint(-1).hour, 23);
  assert.equal(lot.hourlyPoint('not an hour').hour, 0);
  assert.equal(lot.hourlyPoint(10, 100).occupied, 92);
});

test('PEAK_THRESHOLD is the single source for peak marking', () => {
  for (const point of lot.getHourlyCurve()) {
    assert.equal(point.isPeak, point.rate >= lot.PEAK_THRESHOLD);
  }
  const peaks = lot.getHourlyCurve().filter((p) => p.isPeak);
  assert.equal(peaks[0].label, '09:00');
  assert.equal(peaks[peaks.length - 1].label, '14:00');
});

test('each camera view monitors the stall count declared in ATIDIM_LOT', () => {
  for (const cam of lot.ATIDIM_LOT.cameras) {
    const spots = lot.createCameraSpots(cam.id, 10);
    assert.equal(spots.length, cam.spotsMonitored, cam.id + ' stall count must match its metadata');
    const zone = lot.cameraView(cam.id).zone;
    assert.ok(spots.every((s) => s.id.startsWith(zone + '-')), cam.id + ' stalls belong to zone ' + zone);
  }
});

test('camera views are distinct so switching cameras changes the frame', () => {
  const ids = Object.keys(lot.CAMERA_VIEWS);
  assert.ok(ids.length >= 3);
  const labels = new Set(ids.map((id) => lot.cameraView(id).label));
  const huds = new Set(ids.map((id) => lot.cameraView(id).hud));
  assert.equal(labels.size, ids.length);
  assert.equal(huds.size, ids.length);
  assert.notEqual(lot.createCameraSpots('cam-01', 10).length, lot.createCameraSpots('cam-02', 10).length);
});

test('cameraView falls back to the gate camera for an unknown id', () => {
  assert.equal(lot.cameraView('cam-99').zone, 'A');
  assert.equal(lot.cameraView(null).zone, 'A');
  assert.equal(lot.cameraView('CAM-02').zone, 'B');
});

test('seeded occupancy matches the hourly curve, so counters and chart agree', () => {
  for (const hour of [3, 9, 12, 20]) {
    const spots = lot.createCameraSpots('cam-01', hour);
    const expected = Math.round(lot.hourlyPoint(hour).rate * spots.length);
    const occupied = spots.filter((s) => s.occupied).length;
    assert.equal(occupied, expected, 'hour ' + hour + ' must seed ' + expected + ' occupied stalls');
    // The lot-level reading must land on the same side of the curve.
    const summary = lot.calculateOccupancy(spots, lot.ATIDIM_LOT.totalCapacity);
    assert.ok(Math.abs(summary.rate - lot.hourlyPoint(hour).rate) <= 0.03,
      'hour ' + hour + ': lot rate ' + summary.rate + ' drifted from the curve');
  }
});

test('seeding is deterministic and spread across the frame', () => {
  const a = lot.createCameraSpots('cam-01', 9);
  const b = lot.createCameraSpots('cam-01', 9);
  assert.deepEqual(a.map((s) => s.occupied), b.map((s) => s.occupied));
  // Not simply the first N stalls: at the 09:00 peak some free stall must sit
  // before an occupied one, otherwise the overlay looks like a filled block.
  const free = a.findIndex((s) => !s.occupied);
  const lastOccupied = a.reduce((acc, s, i) => (s.occupied ? i : acc), -1);
  assert.ok(free >= 0 && free < lastOccupied);
});

test('every overlay box stays inside the camera frame', () => {
  for (const cam of lot.ATIDIM_LOT.cameras) {
    for (const s of lot.createCameraSpots(cam.id, 10)) {
      assert.ok(s.x >= 0 && s.x + s.w <= 1, cam.id + ' ' + s.id + ' overflows horizontally');
      assert.ok(s.y >= 0 && s.y + s.h <= 1, cam.id + ' ' + s.id + ' overflows vertically');
      assert.ok(s.w > 0 && s.h > 0);
    }
  }
});

test('demo page derives its clock and current hour from the model', () => {
  assert.match(demoHtml, /model\.formatLotClock\(new Date\(\)\)/);
  assert.match(demoHtml, /model\.lotHour\(\)/);
  // A UTC ISO string in the HUD showed Tel Aviv 16:48 as 13:48.
  assert.doesNotMatch(demoHtml, /toISOString\(\)/);
  // The "now" bar must not be pinned to a hard-coded hour.
  assert.doesNotMatch(demoHtml, /pt\.hour === \d+/);
  assert.match(demoHtml, /pt\.hour === nowHour/);
});

test('demo page seeds the frame per camera from the model', () => {
  assert.match(demoHtml, /model\.createCameraSpots\(currentCam, seededHour\)/);
  assert.match(demoHtml, /model\.cameraView\(currentCam\)/);
  assert.match(demoHtml, /id="btnReset"/);
});

test('demo page has a roundRect fallback so the frame cannot blank out', () => {
  assert.match(demoHtml, /typeof ctx\.roundRect === 'function'/);
  assert.match(demoHtml, /quadraticCurveTo/);
  assert.doesNotMatch(demoHtml, /ctx\.beginPath\(\); ctx\.roundRect/);
});

test('demo page states plainly that the frame is a simulation', () => {
  assert.match(demoHtml, /הדמיה ממוחשבת/);
  assert.match(demoHtml, /אין כאן שידור חי/);
  assert.match(demoHtml, /SIM/);
});

test('demo page exposes the live counters and canvas to assistive tech', () => {
  assert.match(demoHtml, /aria-live="polite"/);
  assert.match(demoHtml, /<canvas id="lotCanvas"[^>]*tabindex="0"/);
  assert.match(demoHtml, /canvas\.addEventListener\('keydown'/);
  assert.match(demoHtml, /id="bayStatus"[^>]*role="status"/);
  // Free-count KPI is reported as free / monitored, not occupied / monitored.
  assert.match(demoHtml, /occ\.availableInView \+ ' \/ ' \+ occ\.totalInView/);
});

test('the operator demo is part of the offline shell', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(sw, /'\.\/demo\/atidim\.html'/);
  assert.match(sw, /'\.\/src\/lib\/atidim-lot\.js'/);
  assert.ok(fs.existsSync(path.join(root, 'demo', 'atidim.html')));
  // No runtime network calls at all: the page must open in airplane mode.
  assert.doesNotMatch(demoHtml, /fetch\(|XMLHttpRequest/);
});

test('the pitch doc quotes the peak window the chart actually draws', () => {
  const pitch = fs.readFileSync(path.join(root, 'docs', 'CITYZONE_ATIDIM_PITCH.md'), 'utf8');
  const peaks = lot.getHourlyCurve().filter((p) => p.isPeak);
  const window = peaks[0].label + '–' + peaks[peaks.length - 1].label;
  assert.ok(
    pitch.includes(window) || pitch.includes(peaks[0].label + '-' + peaks[peaks.length - 1].label),
    'pitch doc must quote the peak window ' + window
  );
  // No fixed counter reading: the page shows the current hour, not 148 free.
  assert.doesNotMatch(pitch, /148 פנויים/);
  assert.match(pitch, /הדמיה/);
});
