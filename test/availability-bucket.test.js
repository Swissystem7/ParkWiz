// Backlog item 3: bucketedAvailability(reports, nowMs, bucketMinutes) - the
// weightedAvailability score summarised per fixed backward-looking window.
//
// NOW is a literal, exactly as in test/availability.test.js. There is no clock
// and no network here. Every report below sits at a whole multiple of the
// half-life, so every weight is an exact binary fraction and every expected
// score is exact rather than approximate:
//
//   age  0 min -> 0.5^0 = 1
//   age 15 min -> 0.5^1 = 0.5
//   age 30 min -> 0.5^2 = 0.25
//   age 45 min -> 0.5^3 = 0.125
//   age 90 min -> 0.5^6 = 0.015625
//   age 120 min -> 0.5^8 = 0.00390625
//
// All of the numbers pinned below were computed in a python3 scratch script
// before bucketedAvailability was written.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  weightedAvailability,
  bucketedAvailability,
  HALF_LIFE_MS,
  MAX_AGE_MS,
} = require('../src/lib/availability');

const NOW = 1_000_000_000_000;
const MIN = 60 * 1000;
const at = (ageMinutes, delta) => ({ ts: NOW - ageMinutes * MIN, delta });

// deliberately not in time order: bucketing must not depend on input order
const REPORTS = [
  at(0, 2),    // weight 1       -> +2
  at(15, -1),  // weight 0.5     -> -0.5
  at(30, 1),   // weight 0.25    -> +0.25
  at(45, 4),   // weight 0.125   -> +0.5
  at(90, 1),   // weight 1/64    -> +0.015625
  at(120, 8),  // weight 1/256   -> +0.03125   (exactly on the MAX_AGE edge)
  { ts: NOW - MAX_AGE_MS - 1, delta: 100 }, // one millisecond too old: dropped
];

test('the fixture weights are the exact binary fractions the comments claim', () => {
  assert.equal(HALF_LIFE_MS, 15 * MIN);
  assert.equal(MAX_AGE_MS, 120 * MIN);
  assert.equal(Math.pow(0.5, 90 / 15), 0.015625);
  assert.equal(Math.pow(0.5, 120 / 15), 0.00390625);
});

test('30-minute buckets: four windows, hand-computed scores', () => {
  const b = bucketedAvailability(REPORTS, NOW, 30);
  assert.equal(b.length, 4);
  // 2 - 0.5
  assert.equal(b[0].score, 1.5);
  assert.equal(b[0].count, 2);
  // 0.25 + 0.5
  assert.equal(b[1].score, 0.75);
  assert.equal(b[1].count, 2);
  // nothing between 60 and 90 minutes ago
  assert.equal(b[2].score, 0);
  assert.equal(b[2].count, 0);
  // 0.015625 + 0.03125 - the 120-minute report is folded into the last bucket
  assert.equal(b[3].score, 0.046875);
  assert.equal(b[3].count, 2);
});

test('bucket windows are contiguous, backward-looking and clamped at MAX_AGE', () => {
  const b = bucketedAvailability(REPORTS, NOW, 30);
  assert.deepEqual(b.map((x) => x.index), [0, 1, 2, 3]);
  assert.equal(b[0].endMs, NOW);
  for (let i = 0; i < b.length; i++) {
    assert.equal(b[i].endMs, NOW - i * 30 * MIN);
    if (i > 0) assert.equal(b[i].endMs, b[i - 1].startMs);
  }
  assert.equal(b[3].startMs, NOW - MAX_AGE_MS);
  assert.equal(b[3].startMs, 999992800000);
  assert.equal(b[0].startMs, 999998200000);
});

test('the buckets always sum back to weightedAvailability', () => {
  for (const minutes of [1, 5, 15, 20, 30, 45, 50, 60, 120, 240]) {
    const total = bucketedAvailability(REPORTS, NOW, minutes)
      .reduce((s, x) => s + x.score, 0);
    assert.equal(total, weightedAvailability(REPORTS, NOW), 'bucketMinutes ' + minutes);
  }
  assert.equal(weightedAvailability(REPORTS, NOW), 2.296875);
});

test('60-minute buckets merge the same reports into two windows', () => {
  const b = bucketedAvailability(REPORTS, NOW, 60);
  assert.equal(b.length, 2);
  // 2 - 0.5 + 0.25 + 0.5
  assert.equal(b[0].score, 2.25);
  assert.equal(b[0].count, 4);
  assert.equal(b[1].score, 0.046875);
  assert.equal(b[1].count, 2);
});

test('a bucket size that does not divide two hours gives a short last window', () => {
  // ceil(120 / 50) = 3 windows covering 150 minutes, so the oldest is clamped
  // from 150 back to 120 minutes and is 20 minutes wide, not 50.
  const b = bucketedAvailability(REPORTS, NOW, 50);
  assert.equal(b.length, 3);
  assert.equal(b[0].score, 2.25);
  assert.equal(b[0].count, 4);
  assert.equal(b[1].score, 0.015625);
  assert.equal(b[1].count, 1);
  assert.equal(b[2].score, 0.03125);
  assert.equal(b[2].count, 1);
  assert.equal(b[2].endMs - b[2].startMs, 20 * MIN);
  assert.equal(b[0].endMs - b[0].startMs, 50 * MIN);
  assert.equal(b[2].startMs, NOW - MAX_AGE_MS);
});

test('a bucket bigger than the whole window is a single window', () => {
  const b = bucketedAvailability(REPORTS, NOW, 240);
  assert.equal(b.length, 1);
  assert.equal(b[0].score, weightedAvailability(REPORTS, NOW));
  assert.equal(b[0].count, 6);
  assert.equal(b[0].startMs, NOW - MAX_AGE_MS);
  assert.equal(b[0].endMs, NOW);
});

test('the same drop rule as weightedAvailability, on the same boundary', () => {
  const onEdge = [{ ts: NOW - MAX_AGE_MS, delta: 1 }];
  const oneMsOlder = [{ ts: NOW - MAX_AGE_MS - 1, delta: 1 }];
  const b = bucketedAvailability(onEdge, NOW, 30);
  assert.equal(b[3].count, 1);
  assert.equal(b[3].score, 0.00390625);
  assert.equal(b.reduce((s, x) => s + x.score, 0), weightedAvailability(onEdge, NOW));
  const stale = bucketedAvailability(oneMsOlder, NOW, 30);
  assert.deepEqual(stale.map((x) => x.count), [0, 0, 0, 0]);
  assert.equal(stale.reduce((s, x) => s + x.score, 0), 0);
  assert.equal(weightedAvailability(oneMsOlder, NOW), 0);
});

test('input order does not change the table', () => {
  const forward = bucketedAvailability(REPORTS, NOW, 30);
  const backward = bucketedAvailability([...REPORTS].reverse(), NOW, 30);
  assert.deepEqual(forward.map((x) => x.count), backward.map((x) => x.count));
  assert.deepEqual(forward.map((x) => x.score), backward.map((x) => x.score));
});

test('an empty or malformed report list gives empty buckets, never NaN', () => {
  for (const input of [[], null, undefined, 'nope', [null], [{ ts: NaN, delta: 1 }], [{ ts: NOW, delta: 'x' }]]) {
    const b = bucketedAvailability(input, NOW, 30);
    assert.equal(b.length, 4);
    assert.deepEqual(b.map((x) => x.score), [0, 0, 0, 0]);
    assert.deepEqual(b.map((x) => x.count), [0, 0, 0, 0]);
  }
});

test('a bucket size that is not a positive number is a programmer error', () => {
  for (const bad of [0, -30, NaN, Infinity, undefined, null, 'thirty']) {
    assert.throws(() => bucketedAvailability(REPORTS, NOW, bad), RangeError);
  }
});

test('a future report keeps exactly the weight weightedAvailability gives it', () => {
  // weightedAvailability(validate = false) counts a future report with a
  // weight above 1. bucketedAvailability does not second-guess that; it puts
  // it in bucket 0. Callers who care must validate first.
  const future = [{ ts: NOW + HALF_LIFE_MS, delta: 1 }];
  const b = bucketedAvailability(future, NOW, 30);
  assert.equal(b[0].count, 1);
  assert.equal(b[0].score, 2); // 0.5^-1
  assert.equal(b.reduce((s, x) => s + x.score, 0), weightedAvailability(future, NOW));
  assert.throws(() => weightedAvailability(future, NOW, true), RangeError);
});
