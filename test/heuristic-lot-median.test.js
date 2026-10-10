const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('../src/lib/heuristic.js');

const patch = (id, mean) => ({ id, cur: { mean, variance: 40, mad: 4, p10: mean - 8, p90: mean + 8 } });

test('estimateLot classifies lighting from the true median of an even patch count', () => {
  // Means 30 and 80: median 55 is dusk. The upper-middle value (80) would say day.
  const lot = h.estimateLot([patch('a', 30), patch('b', 80)]);
  assert.equal(lot.lighting, 'dusk');
});

test('estimateLot median is unchanged for an odd patch count', () => {
  const lot = h.estimateLot([patch('a', 20), patch('b', 30), patch('c', 150)]);
  assert.equal(lot.lighting, 'night');
});

test('estimateLot still honours an explicit lighting override', () => {
  const lot = h.estimateLot([patch('a', 30), patch('b', 80)], { lighting: 'night' });
  assert.equal(lot.lighting, 'night');
});
