const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cmp = require('../src/lib/compare');
const proto = require('../src/lib/protocol');

const samplePairs = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'pilot', 'sample-pairs.json'), 'utf8')
).map(cmp.pairObservation);

function fieldPairsFromSample() {
  return samplePairs.map((p) => ({ ...p, source: 'field' }));
}

test('Wilson interval is a 95% interval inside [0, 1]', () => {
  const w = proto.wilsonInterval(162, 168, 1.96);
  assert.ok(w.lo < w.p && w.p < w.hi);
  assert.ok(w.lo >= 0 && w.hi <= 1);
  assert.ok(Math.abs(w.p - 162 / 168) < 1e-12);
  assert.equal(proto.wilsonInterval(1, 0), null);
  assert.equal(proto.wilsonInterval(-1, 10), null);
});

test('pooled agreement on the sample series is 162/168', () => {
  const pooled = proto.pooledAgreement(samplePairs);
  assert.equal(pooled.trials, 168);
  assert.equal(pooled.agree, 162);
  assert.ok(Math.abs(pooled.rate - 162 / 168) < 1e-12);
  assert.ok(Math.abs(pooled.meanSignedError - 4 / 14) < 1e-12);
  assert.ok(pooled.wilson);
});

test('sample-only series never yields a field PARK/CONTINUE', () => {
  const v = proto.decidePilot({ pairs: samplePairs });
  assert.equal(v.code, 'SAMPLE_ONLY');
  assert.match(v.label, /דוגמה/);
  assert.ok(v.reasons.some((r) => r.includes('sample')));
});

test('too few field pairs stay INSUFFICIENT', () => {
  const v = proto.decidePilot({
    pairs: fieldPairsFromSample().slice(0, 3),
  });
  assert.equal(v.code, 'INSUFFICIENT');
  assert.ok(v.pooled.trials < proto.MIN_SPOT_TRIALS || v.summary.count < proto.MIN_PAIRS);
});

test('low accuracy without a calibration plan is PARK_ACCURACY', () => {
  const bad = [];
  for (let i = 0; i < 10; i++) {
    bad.push(cmp.pairObservation({
      ts: 't' + i, street: 'הרצל', total: 12, systemOccupied: 2, manualOccupied: 10, source: 'field',
    }));
  }
  const v = proto.decidePilot({ pairs: bad, hasCalibrationPlan: false });
  assert.equal(v.code, 'PARK_ACCURACY');
  assert.ok(v.pooled.rate < 0.96);
});

test('low accuracy with a written calibration plan continues', () => {
  const bad = [];
  for (let i = 0; i < 10; i++) {
    bad.push(cmp.pairObservation({
      ts: 't' + i, street: 'הרצל', total: 12, systemOccupied: 2, manualOccupied: 10, source: 'field',
    }));
  }
  const v = proto.decidePilot({ pairs: bad, hasCalibrationPlan: true });
  assert.equal(v.code, 'CONTINUE');
});

test('30 days after outreach with no camera and no integrator is PARK_NO_ACCESS', () => {
  const v = proto.decidePilot({
    pairs: fieldPairsFromSample(),
    outreachSentAt: '2026-07-01',
    now: '2026-08-13T12:00:00Z',
    cameraAccess: false,
    integratorAsk: false,
  });
  assert.equal(v.code, 'PARK_NO_ACCESS');
  assert.equal(v.daysSinceOutreach, 43);
});

test('same series with camera access continues instead of parking on access', () => {
  const v = proto.decidePilot({
    pairs: fieldPairsFromSample(),
    outreachSentAt: '2026-07-01',
    now: '2026-08-13T12:00:00Z',
    cameraAccess: true,
  });
  assert.equal(v.code, 'CONTINUE');
});

test('calendar is 30 UTC days and merge keeps lighting notes', () => {
  const cal = proto.buildCalendar('2026-08-01', 30);
  assert.equal(cal.length, 30);
  assert.equal(cal[0].date, '2026-08-01');
  assert.equal(cal[29].date, '2026-08-30');
  const merged = proto.mergeLog(cal, [
    { day: 2, lighting: 'לילה', total: 12, systemOccupied: 4, manualOccupied: 5, source: 'field', note: 'פקח ב׳' },
  ]);
  assert.equal(merged[1].lighting, 'לילה');
  assert.equal(merged[1].manualOccupied, 5);
  const pairs = proto.logToPairs(merged, 'הרצל, נתניה');
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].accuracy, 1 - 1 / 12);
});

test('normalizeDay rejects out-of-range days and clamps counts', () => {
  assert.equal(proto.normalizeDay({ day: 0, total: 10, systemOccupied: 1, manualOccupied: 1 }), null);
  assert.equal(proto.normalizeDay({ day: 31, total: 10, systemOccupied: 1, manualOccupied: 1 }), null);
  const d = proto.normalizeDay({ day: 3, total: 10, systemOccupied: 99, manualOccupied: -2 });
  assert.equal(d.systemOccupied, 10);
  assert.equal(d.manualOccupied, 0);
});

test('pooled bias divides by the pairs that were actually counted', () => {
  const pooled = proto.pooledAgreement([
    { total: 10, systemOccupied: 8, manualOccupied: 6 },
    { total: 10, systemOccupied: 'n/a', manualOccupied: 5 },
    { total: 10, manualOccupied: 5 },
    { total: 10, systemOccupied: 7, manualOccupied: 7 },
  ]);
  assert.equal(pooled.trials, 20);
  assert.equal(pooled.agree, 18);
  // signed error is +2 over 2 counted pairs, not over the 4 pairs offered
  assert.equal(pooled.meanSignedError, 1);
});

test('days since outreach accept a Date, an epoch-ms number and a string alike', () => {
  const asDate = new Date(Date.UTC(2026, 9, 6, 12));
  assert.equal(proto.daysSince('2026-09-01', asDate), 35);
  assert.equal(proto.daysSince('2026-09-01', asDate.getTime()), 35);
  assert.equal(proto.daysSince('2026-09-01', '2026-10-06T12:00:00Z'), 35);
  assert.equal(proto.daysSince('2026-09-01', NaN), null);
  assert.equal(proto.daysSince('not-a-day', asDate), null);
});

test('PARK_NO_ACCESS still fires when now is given as epoch milliseconds', () => {
  const v = proto.decidePilot({
    pairs: fieldPairsFromSample(),
    outreachSentAt: '2026-07-01',
    now: Date.UTC(2026, 7, 13, 12),
    cameraAccess: false,
    integratorAsk: false,
  });
  assert.equal(v.code, 'PARK_NO_ACCESS');
  assert.equal(v.daysSinceOutreach, 43);
});

test('vendor claims stay labeled as manufacturer statements', () => {
  assert.equal(proto.VENDOR_CLAIMS.length, 2);
  assert.ok(proto.VENDOR_CLAIMS.every((c) => c.note.includes('הצהרת יצרן')));
  assert.equal(proto.VENDOR_CLAIMS[0].rate, 0.96);
});
