const test = require('node:test');
const assert = require('node:assert/strict');
const occ = require('../src/lib/occupancy');

test('normalize accepts the kit schema and legacy keys', () => {
  const a = occ.normalize({ ts: 't', street: 'הרצל', total: 12, occupied: 4, source: 'heuristic-brightness', confidence: 0.4 });
  const b = occ.normalize({ ts: 't', street: 'הרצל', totalSpots: 12, occupiedSpots: 4, occupancyRate: 0.33 });
  assert.equal(a.total, 12);
  assert.equal(a.occupied, 4);
  assert.equal(b.total, 12);
  assert.equal(b.occupied, 4);
  assert.ok(Math.abs(occ.occupancyRate(a) - 4 / 12) < 1e-9);
});

test('parse reads a JSON array and JSONL', () => {
  const arr = occ.parse(JSON.stringify([
    { ts: '2026-08-12T08:00:00', street: 'הרצל', total: 10, occupied: 3, source: 'sample', confidence: 0.2 },
    { ts: '2026-08-12T09:00:00', street: 'הרצל', total: 10, occupied: 8, source: 'sample', confidence: 0.2 },
  ]));
  assert.equal(arr.length, 2);
  const lines = occ.parse('{"ts":"a","total":5,"occupied":1}\n{"ts":"b","total":5,"occupied":2}\n');
  assert.equal(lines.length, 2);
});

test('bad records are dropped', () => {
  assert.equal(occ.parse('{"foo":1}').length, 0);
  assert.equal(occ.normalize(null), null);
  assert.equal(occ.normalize({ total: 0, occupied: 1 }), null);
});

test('summarize and chart use one rate function', () => {
  const recs = occ.parse(JSON.stringify([
    { ts: '2026-08-12T08:00:00', street: 'הרצל', total: 10, occupied: 2, source: 'sample', confidence: 0.2 },
    { ts: '2026-08-12T18:00:00', street: 'הרצל', total: 10, occupied: 9, source: 'sample', confidence: 0.4 },
  ]));
  const s = occ.summarize(recs);
  assert.equal(s.count, 2);
  assert.equal(s.peak.occupied, 9);
  assert.equal(s.low.occupied, 2);
  assert.ok(occ.chartSvg(recs).includes('<path'));
  assert.ok(occ.planningNotes(s).some((n) => n.includes('המלצת אכיפה')));
});
