const test = require('node:test');
const assert = require('node:assert/strict');
const { weightedAvailability, HALF_LIFE_MS, MAX_AGE_MS } = require('../src/lib/availability');

const NOW = 1_000_000_000_000;

test('no reports means no signal', () => {
  assert.equal(weightedAvailability([], NOW), 0);
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
