const test = require('node:test');
const assert = require('node:assert/strict');
const { weightedAvailability, countActiveReports, isActiveReport, HALF_LIFE_MS, MAX_AGE_MS } = require('../src/lib/availability');

const NOW = 1_000_000_000_000;

test('no reports means no signal', () => {
  assert.equal(weightedAvailability([], NOW), 0);
});

test('report with future timestamp throws error', () => {
  const futureReport = { ts: NOW + 1000, delta: 1 };
  assert.throws(() => weightedAvailability([futureReport], NOW, true), RangeError, "Report timestamp cannot be in the future");
});

test('mix of valid and future reports throws error', () => {
  const validReport = { ts: NOW - 1000, delta: 1 };
  const futureReport = { ts: NOW + 1000, delta: 1 };
  assert.throws(() => weightedAvailability([validReport, futureReport], NOW, true), RangeError, "Report timestamp cannot be in the future");
});

test('only valid reports returns original score', () => {
  const validReport = { ts: NOW - 1000, delta: 1 };
  assert.equal(
    weightedAvailability([validReport], NOW, true),
    weightedAvailability([validReport], NOW)
  );
});

test('a report made right now carries its full weight', () => {
  assert.equal(weightedAvailability([{ ts: NOW, delta: 1 }], NOW), 1);
});

test('weight halves after one half-life', () => {
  assert.equal(weightedAvailability([{ ts: NOW - HALF_LIFE_MS, delta: 1 }], NOW), 0.5);
});

test('weight quarters after two half-lives', () => {
  assert.equal(weightedAvailability([{ ts: NOW - 2 * HALF_LIFE_MS, delta: 1 }], NOW), 0.25);
});

test('reports older than the cutoff are dropped, not decayed', () => {
  assert.equal(weightedAvailability([{ ts: NOW - MAX_AGE_MS - 1, delta: 1 }], NOW), 0);
});

test('a report exactly at the cutoff still counts', () => {
  assert.ok(weightedAvailability([{ ts: NOW - MAX_AGE_MS, delta: 1 }], NOW) > 0);
});

test('opposite reports at the same moment cancel out', () => {
  const score = weightedAvailability([{ ts: NOW, delta: 1 }, { ts: NOW, delta: -1 }], NOW);
  assert.ok(Math.abs(score) < 1e-9);
});

test('a stale burst cannot outweigh one fresh report', () => {
  const stale = Array.from({ length: 50 }, () => ({ ts: NOW - MAX_AGE_MS - 1, delta: 1 }));
  const fresh = { ts: NOW, delta: 1 };
  assert.equal(weightedAvailability([...stale, fresh], NOW), 1);
});

test('report order does not change the score', () => {
  const reports = [
    { ts: NOW - HALF_LIFE_MS, delta: 2 },
    { ts: NOW, delta: -1 },
    { ts: NOW - 3 * HALF_LIFE_MS, delta: 4 },
  ];
  const forward = weightedAvailability(reports, NOW);
  const backward = weightedAvailability([...reports].reverse(), NOW);
  assert.ok(Math.abs(forward - backward) < 1e-12);
});

test('future report with validate=false contributes zero weight', () => {
  const result = weightedAvailability([{ ts: NOW + 60000, delta: 1 }], NOW);
  assert.equal(result, 0);
});

// --- robustness: malformed input must never poison the score ---

test('a non-array input yields no signal instead of throwing', () => {
  assert.equal(weightedAvailability(undefined, NOW), 0);
  assert.equal(weightedAvailability(null, NOW), 0);
});

test('a report with a non-numeric delta is ignored, not turned into NaN', () => {
  const score = weightedAvailability([{ ts: NOW, delta: 1 }, { ts: NOW, delta: 'two' }], NOW);
  assert.equal(score, 1);
});

test('a report with a missing timestamp is ignored, not turned into NaN', () => {
  const score = weightedAvailability([{ ts: NOW, delta: 1 }, { delta: 1 }, null], NOW);
  assert.equal(score, 1);
});

test('validate mode still throws for a well-formed future report among junk', () => {
  assert.throws(
    () => weightedAvailability([{ delta: 1 }, { ts: NOW + 1, delta: 1 }], NOW, true),
    RangeError
  );
});

// --- countActiveReports shares the cutoff with weightedAvailability ---

test('countActiveReports counts only reports inside the decay window', () => {
  const reports = [
    { ts: NOW, delta: 1 },
    { ts: NOW - MAX_AGE_MS, delta: 1 },        // exactly at cutoff: counts
    { ts: NOW - MAX_AGE_MS - 1, delta: 1 },    // just past cutoff: dropped
    { ts: NOW + 1000, delta: 1 },              // future: dropped
    { delta: 1 },                              // malformed: dropped
  ];
  assert.equal(countActiveReports(reports, NOW), 2);
});

test('countActiveReports on empty or non-array input is zero', () => {
  assert.equal(countActiveReports([], NOW), 0);
  assert.equal(countActiveReports(undefined, NOW), 0);
});

test('a report contributes weight if and only if it is counted as active', () => {
  const candidates = [
    { ts: NOW, delta: 1 },
    { ts: NOW - MAX_AGE_MS, delta: 1 },
    { ts: NOW - MAX_AGE_MS - 1, delta: 1 },
    { ts: NOW + 1, delta: 1 },
    { ts: 'x', delta: 1 },
  ];
  for (const r of candidates) {
    const counted = isActiveReport(r, NOW);
    const weighs = weightedAvailability([r], NOW) > 0;
    assert.equal(counted, weighs, JSON.stringify(r));
  }
});
