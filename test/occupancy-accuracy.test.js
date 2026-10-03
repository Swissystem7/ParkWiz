// Backlog item 2 ("accuracyWilson"): mean agreement plus a two-sided Wilson
// score interval for system-vs-inspector counts.
//
// The backlog asked for this in src/lib/occupancy.js. It lives in
// src/lib/protocol.js instead: occupancy.js is the dependency root of this
// repo (compare.js and protocol.js both require it, nothing is required by
// it), and the interval needs wilsonInterval + compare.summarizePairs, so
// putting it in occupancy.js would have meant either a require cycle or a
// second copy of the Wilson formula. The test file keeps the backlog's name
// so the item stays traceable.
//
// Every number below was computed by hand from the derivation in
// protocol.js (a separate python3 script), not read out of the implementation.
const test = require('node:test');
const assert = require('node:assert/strict');
const proto = require('../src/lib/protocol');
const compare = require('../src/lib/compare');

// total 10, |7-7|=0 -> accuracy 1.00, 10 agreeing spot comparisons
// total 10, |6-8|=2 -> accuracy 0.80,  8 agreeing spot comparisons
// total 20, |15-12|=3 -> accuracy 0.85, 17 agreeing spot comparisons
// trials = 40, agree = 35, pooled = 35/40 = 0.875
// mean   = (1.00 + 0.80 + 0.85) / 3 = 2.65 / 3 = 0.8833333333333333
const PAIRS = compare.parsePairs(JSON.stringify([
  { ts: '2026-08-12T08:00', street: 'הרצל', total: 10, systemOccupied: 7, manualOccupied: 7, source: 'field' },
  { ts: '2026-08-12T09:00', street: 'הרצל', total: 10, systemOccupied: 6, manualOccupied: 8, source: 'field' },
  { ts: '2026-08-12T10:00', street: 'הרצל', total: 20, systemOccupied: 15, manualOccupied: 12, source: 'field' },
]));

test('the fixture parses into three pairs with the hand-computed accuracies', () => {
  assert.equal(PAIRS.length, 3);
  assert.deepEqual(PAIRS.map((p) => p.accuracy), [1, 0.8, 0.85]);
});

test('mean agreement and pooled agreement are different numbers, both reported', () => {
  const r = proto.accuracyWilson(PAIRS);
  assert.equal(r.count, 3);
  // 2.65 / 3 — the mean over pairs, every pair weighted the same
  assert.equal(r.meanAgreement, 0.8833333333333333);
  // 35 / 40 — the pooled rate over spot comparisons, the big lot weighs more
  assert.equal(r.trials, 40);
  assert.equal(r.agree, 35);
  assert.equal(r.pooledAgreement, 0.875);
  assert.notEqual(r.meanAgreement, r.pooledAgreement);
  assert.equal(r.minAgreement, 0.8);
  assert.equal(r.maxAgreement, 1);
});

test('the default interval is the 95% two-sided Wilson interval on 35/40', () => {
  const r = proto.accuracyWilson(PAIRS);
  assert.equal(r.z, proto.Z95);
  assert.equal(r.z, 1.96);
  assert.equal(r.wilson.n, 40);
  assert.equal(r.wilson.successes, 35);
  assert.equal(r.wilson.p, 0.875);
  assert.ok(Math.abs(r.wilson.lo - 0.7388757932976187) < 1e-12, 'lo = ' + r.wilson.lo);
  assert.ok(Math.abs(r.wilson.hi - 0.9454058022645873) < 1e-12, 'hi = ' + r.wilson.hi);
  // the point estimate must sit inside its own interval
  assert.ok(r.wilson.lo < r.pooledAgreement && r.pooledAgreement < r.wilson.hi);
});

test('a smaller z gives a strictly narrower interval, a larger z a wider one', () => {
  const z90 = proto.accuracyWilson(PAIRS, 1.2815515655446004);
  const z99 = proto.accuracyWilson(PAIRS, 2.5758293035489004);
  assert.equal(z90.z, 1.2815515655446004);
  assert.ok(Math.abs(z90.wilson.lo - 0.7928862249635337) < 1e-12, 'lo = ' + z90.wilson.lo);
  assert.ok(Math.abs(z90.wilson.hi - 0.9275337900173067) < 1e-12, 'hi = ' + z90.wilson.hi);
  assert.ok(Math.abs(z99.wilson.lo - 0.6859728708466316) < 1e-12, 'lo = ' + z99.wilson.lo);
  assert.ok(Math.abs(z99.wilson.hi - 0.9573222190226801) < 1e-12, 'hi = ' + z99.wilson.hi);
  const width = (r) => r.wilson.hi - r.wilson.lo;
  const z95 = proto.accuracyWilson(PAIRS);
  assert.ok(width(z90) < width(z95), 'z=1.28 must be narrower than z=1.96');
  assert.ok(width(z95) < width(z99), 'z=1.96 must be narrower than z=2.58');
});

test('a bad or missing z falls back to Z95 instead of producing NaN', () => {
  const base = proto.accuracyWilson(PAIRS);
  for (const bad of [undefined, null, 0, -1, 'nope', NaN]) {
    const r = proto.accuracyWilson(PAIRS, bad);
    assert.equal(r.z, proto.Z95);
    assert.equal(r.wilson.lo, base.wilson.lo);
    assert.equal(r.wilson.hi, base.wilson.hi);
  }
});

test('a perfect series still gets a lower bound below 1 — Wilson does not claim certainty', () => {
  const perfect = compare.parsePairs(JSON.stringify([
    { ts: '2026-08-12T08:00', street: 'הרצל', total: 12, systemOccupied: 4, manualOccupied: 4, source: 'field' },
  ]));
  const r = proto.accuracyWilson(perfect);
  assert.equal(r.meanAgreement, 1);
  assert.equal(r.pooledAgreement, 1);
  assert.equal(r.wilson.hi, 1);
  // 12/12 at z = 1.96
  assert.ok(Math.abs(r.wilson.lo - 0.7574992425007574) < 1e-12, 'lo = ' + r.wilson.lo);
});

test('no usable pairs means no number, not a zero', () => {
  const r = proto.accuracyWilson([]);
  assert.equal(r.count, 0);
  assert.equal(r.meanAgreement, null);
  assert.equal(r.trials, 0);
  assert.equal(r.pooledAgreement, null);
  assert.equal(r.wilson, null);
  assert.equal(proto.accuracyWilson(null).count, 0);
});

test('a sample-only series is flagged so it is never read as a field result', () => {
  const sample = compare.parsePairs(JSON.stringify([
    { ts: '2026-08-12T08:00', street: 'הרצל', total: 10, systemOccupied: 7, manualOccupied: 7, source: 'sample' },
  ]));
  assert.equal(proto.accuracyWilson(sample).sampleOnly, true);
  assert.equal(proto.accuracyWilson(PAIRS).sampleOnly, false);
});

test('pooledAgreement now honours z, and still defaults to Z95 for its old callers', () => {
  const wide = proto.pooledAgreement(PAIRS, 2.5758293035489004);
  const dflt = proto.pooledAgreement(PAIRS);
  assert.equal(dflt.wilson.z, 1.96);
  assert.equal(wide.wilson.z, 2.5758293035489004);
  assert.ok(Math.abs(wide.wilson.lo - 0.6859728708466316) < 1e-12);
  assert.ok(Math.abs(dflt.wilson.lo - 0.7388757932976187) < 1e-12);
});

test('a z that is not a positive number falls back to Z95', () => {
  // Finding 4 of the independent review: this fallback had no test at all.
  // Asserting it through pooledAgreement alone could not have worked while
  // the rule was copied three times - measured, dropping "zz > 0" from
  // pooledAgreement changed nothing whatsoever, because wilsonInterval
  // sanitised the same z a second time downstream. The rule is one helper
  // now, so these assertions actually hold it up.
  //
  // Hand-derived for 35/40 (python3, from the derivation in protocol.js):
  //   z = 1.96 -> lo 0.7388757932976187, hi 0.9454058022645873
  //   z = 0    -> lo = hi = 0.875, an interval claiming no uncertainty
  //   z = -1   -> lo 0.9183068613844062 above hi 0.8134004556887645
  // Only the first is a confidence interval, so it is what a bad z must give.
  const good = proto.pooledAgreement(PAIRS, 1.96);
  assert.ok(Math.abs(good.wilson.lo - 0.7388757932976187) < 1e-12);
  assert.ok(Math.abs(good.wilson.hi - 0.9454058022645873) < 1e-12);
  for (const bad of [-1, 0, -0.5, NaN, Infinity, -Infinity, 'x', null, undefined, {}]) {
    const label = ' for z = ' + String(bad);
    const p = proto.pooledAgreement(PAIRS, bad);
    assert.equal(p.wilson.z, 1.96, 'pooledAgreement' + label);
    assert.deepEqual(p.wilson, good.wilson, 'pooledAgreement' + label);
    assert.notEqual(p.wilson.lo, p.wilson.hi, 'a real interval' + label);
    assert.ok(p.wilson.lo < p.rate && p.rate < p.wilson.hi, 'interval brackets the rate' + label);
    const w = proto.wilsonInterval(35, 40, bad);
    assert.equal(w.z, 1.96, 'wilsonInterval' + label);
    assert.deepEqual(w, proto.wilsonInterval(35, 40, 1.96), 'wilsonInterval' + label);
    assert.equal(proto.accuracyWilson(PAIRS, bad).z, 1.96, 'accuracyWilson' + label);
  }
  // and a positive z is still honoured rather than swallowed by the fallback
  assert.equal(proto.pooledAgreement(PAIRS, 2.5758293035489004).wilson.z, 2.5758293035489004);
  assert.equal(proto.wilsonInterval(35, 40, 0.5).z, 0.5);
});
