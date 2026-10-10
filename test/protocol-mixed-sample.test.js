const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cmp = require('../src/lib/compare');
const proto = require('../src/lib/protocol');

const samplePairs = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'pilot', 'sample-pairs.json'), 'utf8')
).map(cmp.pairObservation);

function fieldPair(i) {
  return cmp.pairObservation({
    ts: 'f' + i, street: 'הרצל', total: 12, systemOccupied: 5, manualOccupied: 5, source: 'field',
  });
}

test('one field pair typed over a sample series stays INSUFFICIENT', () => {
  const v = proto.decidePilot({ pairs: samplePairs.concat([fieldPair(0)]) });
  assert.equal(v.code, 'INSUFFICIENT');
  assert.equal(v.summary.count, 1);
  assert.equal(v.pooled.trials, 12);
  assert.ok(v.reasons.some((r) => r.startsWith(samplePairs.length + ' זוגות דוגמה')));
});

test('sample pairs do not drag a good field series into PARK_ACCURACY', () => {
  const bad = [];
  for (let i = 0; i < 10; i++) {
    bad.push(cmp.pairObservation({
      ts: 's' + i, street: 'הרצל', total: 12, systemOccupied: 2, manualOccupied: 10, source: 'sample',
    }));
  }
  const field = [];
  for (let i = 0; i < 10; i++) field.push(fieldPair(i));
  const v = proto.decidePilot({ pairs: bad.concat(field) });
  assert.equal(v.code, 'CONTINUE');
  assert.equal(v.pooled.rate, 1);
});

test('a pure sample series is still SAMPLE_ONLY with its own summary', () => {
  const v = proto.decidePilot({ pairs: samplePairs });
  assert.equal(v.code, 'SAMPLE_ONLY');
  assert.equal(v.summary.count, samplePairs.length);
  assert.ok(!v.reasons.some((r) => r.includes('לא נספרו')));
});
