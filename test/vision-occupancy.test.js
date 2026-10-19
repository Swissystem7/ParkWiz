// The camera demo's credibility rests on this module: if a spot flips to free
// while a car is still parked in it, the operator watching the screen in the
// CityZone meeting stops believing the whole pipeline. These tests pin the
// geometry, the debounce and the transition reporting that the page relies on.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const VO = require('../src/lib/vision-occupancy');
const OCC = require('../src/lib/occupancy');

// A 4-spot row across the middle of the frame.
const SPOTS = [
  { id: 'A-01', x: 0.05, y: 0.40, w: 0.20, h: 0.25 },
  { id: 'A-02', x: 0.30, y: 0.40, w: 0.20, h: 0.25 },
  { id: 'A-03', x: 0.55, y: 0.40, w: 0.20, h: 0.25 },
  { id: 'A-04', x: 0.78, y: 0.40, w: 0.18, h: 0.25 },
];

// A car box filling most of the given spot.
function parkedIn(spot) {
  return { x: spot.x + 0.01, y: spot.y + 0.02, w: spot.w - 0.02, h: spot.h - 0.04, cls: 'car', score: 0.9 };
}

function run(tracker, boxes, frames) {
  let state = null;
  for (let i = 0; i < frames; i++) state = tracker.update(boxes, '2026-10-19T09:0' + i + ':00Z');
  return state;
}

test('COCO-SSD pixel predictions become normalized vehicle boxes', () => {
  const preds = [
    { bbox: [160, 180, 80, 60], class: 'car', score: 0.91 },
    { bbox: [0, 0, 40, 40], class: 'person', score: 0.99 },   // a pedestrian is not a vehicle
    { bbox: [10, 10, 40, 40], class: 'car', score: 0.12 },     // below MIN_SCORE
    { bbox: [0, 0, 640, 360], class: 'bus', score: 0.8 },      // whole-frame artefact
  ];
  const boxes = VO.normalizeDetections(preds, { frameWidth: 640, frameHeight: 360 });
  assert.equal(boxes.length, 1);
  assert.deepEqual(boxes[0], { x: 0.25, y: 0.5, w: 0.125, h: 1 / 6, cls: 'car', score: 0.91 });
  // Truck, bus and motorcycle park too; bicycle and person do not.
  assert.deepEqual([...VO.VEHICLE_CLASSES], ['car', 'truck', 'bus', 'motorcycle']);
  assert.ok(!VO.VEHICLE_CLASSES.includes('person'));
  // Already-normalized boxes pass through unchanged (webcam path, no bbox key).
  const direct = VO.normalizeDetections([{ x: 0.1, y: 0.1, w: 0.2, h: 0.2, cls: 'TRUCK', score: 0.7 }]);
  assert.deepEqual(direct, [{ x: 0.1, y: 0.1, w: 0.2, h: 0.2, cls: 'truck', score: 0.7 }]);
  assert.deepEqual(VO.normalizeDetections(null), []);
});

test('overlap scoring claims the bay a car sits in and no other', () => {
  const car = parkedIn(SPOTS[1]);
  assert.equal(VO.boxSpotScore(car, SPOTS[1]), 1);            // centroid inside
  assert.equal(VO.boxSpotScore(car, SPOTS[0]), 0);            // no intersection at all
  // A car in the aisle between two bays clips both edges and claims neither —
  // even though its centre point falls just inside the second bay's rectangle.
  const aisle = { x: 0.24, y: 0.60, w: 0.12, h: 0.08 };
  assert.ok(VO.boxSpotScore(aisle, SPOTS[0]) < VO.DEFAULT_OVERLAP);
  assert.ok(VO.boxSpotScore(aisle, SPOTS[1]) < VO.DEFAULT_OVERLAP);
  // A car centred in a bay painted wider than the car still claims it, which
  // coverage alone (0.21 of the bay here) would miss.
  const small = { x: 0.37, y: 0.47, w: 0.07, h: 0.08 };
  assert.equal(VO.boxSpotScore(small, SPOTS[1]), 1);
  assert.equal(VO.boxSpotScore(null, SPOTS[0]), 0);
  assert.equal(VO.boxSpotScore(parkedIn(SPOTS[0]), { x: 0, y: 0, w: 0, h: 0 }), 0);
});

test('a spot needs a few consistent frames before it is reported occupied', () => {
  const tracker = VO.createTracker(SPOTS);
  const car = [parkedIn(SPOTS[0])];
  assert.equal(tracker.update(car, 't1').occupied, 0);
  assert.equal(tracker.update(car, 't2').occupied, 0);
  const third = tracker.update(car, 't3');
  assert.equal(third.occupied, 1);
  assert.deepEqual(third.taken, ['A-01']);
  assert.equal(third.free, 3);
  assert.equal(third.total, 4);
  assert.equal(third.rate, 0.25);
});

test('a one-frame detector blink never frees an occupied spot', () => {
  const tracker = VO.createTracker(SPOTS);
  const car = [parkedIn(SPOTS[2])];
  run(tracker, car, 4);
  // The detector loses the car for two frames (someone walks past it).
  assert.deepEqual(tracker.update([], 'b1').freed, []);
  assert.deepEqual(tracker.update([], 'b2').freed, []);
  const back = tracker.update(car, 'b3');
  assert.deepEqual(back.freed, []);
  assert.equal(back.occupied, 1, 'the spot must still read occupied through the blink');
});

test('a car really leaving reports the spot freed exactly once', () => {
  const tracker = VO.createTracker(SPOTS, { debounceFrames: 2 });
  run(tracker, [parkedIn(SPOTS[3])], 3);
  assert.deepEqual(tracker.update([], 'g1').freed, []);
  const gone = tracker.update([], 'g2');
  assert.deepEqual(gone.freed, ['A-04']);
  assert.equal(gone.free, 4);
  // It is not re-announced on every later empty frame.
  assert.deepEqual(tracker.update([], 'g3').freed, []);
  assert.deepEqual(tracker.update([], 'g4').freed, []);
});

test('the free counter tracks several cars arriving and leaving', () => {
  const tracker = VO.createTracker(SPOTS, { debounceFrames: 1 });
  assert.equal(tracker.update([], 'e').free, 4);
  const two = tracker.update([parkedIn(SPOTS[0]), parkedIn(SPOTS[1])], 'a');
  assert.equal(two.free, 2);
  assert.deepEqual(two.taken.sort(), ['A-01', 'A-02']);
  const one = tracker.update([parkedIn(SPOTS[1])], 'b');
  assert.equal(one.free, 3);
  assert.deepEqual(one.freed, ['A-01']);
  assert.equal(one.spots.find((s) => s.id === 'A-02').occupied, true);
});

test('spots can be re-marked mid-session without inventing a freed event', () => {
  const tracker = VO.createTracker(SPOTS, { debounceFrames: 1 });
  run(tracker, [parkedIn(SPOTS[0])], 2);
  tracker.setSpots(SPOTS.concat({ id: 'A-05', x: 0.05, y: 0.70, w: 0.2, h: 0.2 }));
  const after = tracker.snapshot('t');
  assert.equal(after.total, 5);
  assert.equal(after.free, 5, 're-marking resets to free; the next frame re-detects');
  assert.deepEqual(tracker.update([parkedIn(SPOTS[0])], 't2').freed, []);
});

test('a drag becomes a spot in the pilot-kit rectangle schema', () => {
  // Dragged bottom-right to top-left: the rect is still normalized.
  const spot = VO.spotFromDrag({ x: 0.5, y: 0.6 }, { x: 0.2, y: 0.3 }, 'A-07');
  assert.deepEqual(spot, { id: 'A-07', w: 0.3, h: 0.3, x: 0.2, y: 0.3 });
  // Out-of-canvas drags clamp instead of producing negative rects.
  const clamped = VO.spotFromDrag({ x: -0.4, y: 0.1 }, { x: 0.3, y: 1.9 }, 'A-08');
  assert.deepEqual(clamped, { id: 'A-08', w: 0.3, h: 0.9, x: 0, y: 0.1 });
  // A mis-click is not a bay.
  assert.equal(VO.spotFromDrag({ x: 0.4, y: 0.4 }, { x: 0.405, y: 0.41 }, 'A-09'), null);
});

test('a live reading is a valid src/lib/occupancy.js record', () => {
  const tracker = VO.createTracker(SPOTS, { debounceFrames: 1 });
  const state = tracker.update([parkedIn(SPOTS[0])], '2026-10-19T09:30:00Z');
  const record = OCC.normalize(VO.toRecord(state, { street: 'חניון עתידים — מצלמה 01' }));
  assert.ok(record, 'the record must survive the shared schema');
  assert.equal(record.total, 4);
  assert.equal(record.occupied, 1);
  assert.equal(record.source, 'camera');
  assert.equal(OCC.occupancyRate(record), 0.25);
  // The session chart and the per-hour rollup are built from these records.
  assert.equal(OCC.byHour([record]).find((h) => h.count > 0).hour, OCC.hourFromTs(record.ts));
  assert.ok(OCC.chartSvg([record, record]).startsWith('<svg'));
});
