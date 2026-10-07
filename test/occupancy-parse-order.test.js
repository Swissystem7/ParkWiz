const test = require('node:test');
const assert = require('node:assert/strict');
const occ = require('../src/lib/occupancy');

// pilot-report.html and pilot-dashboard.html take summarize().last as the
// current reading and summarize().first/last as the pilot period. Those are
// positional, so parse() must hand back chronological order for every input
// shape - the JSONL path already did, the JSON-array path returned file order.
const unordered = [
  { ts: '2026-08-12T18:00:00+03:00', street: 'הרצל', total: 10, occupied: 9, source: 'sample', confidence: 0.4 },
  { ts: '2026-08-12T07:00:00+03:00', street: 'הרצל', total: 10, occupied: 2, source: 'sample', confidence: 0.2 },
  { ts: '2026-08-12T12:00:00+03:00', street: 'הרצל', total: 10, occupied: 6, source: 'sample', confidence: 0.3 },
];

test('parse sorts a JSON array by timestamp, not file order', () => {
  const recs = occ.parse(JSON.stringify(unordered));
  assert.deepEqual(recs.map((r) => r.ts), [
    '2026-08-12T07:00:00+03:00',
    '2026-08-12T12:00:00+03:00',
    '2026-08-12T18:00:00+03:00',
  ]);
  const s = occ.summarize(recs);
  assert.equal(s.first.occupied, 2);
  assert.equal(s.last.occupied, 9);
});

test('a JSON array and the same rows as JSONL parse to the same series', () => {
  const fromArray = occ.parse(JSON.stringify(unordered));
  const fromLines = occ.parse(unordered.map((r) => JSON.stringify(r)).join('\n'));
  assert.deepEqual(fromArray, fromLines);
});

test('a newest-first export round-trips to chronological order', () => {
  const newestFirst = occ.parse(JSON.stringify(unordered)).slice().reverse();
  const again = occ.parse(JSON.stringify(newestFirst));
  assert.equal(again[0].ts, '2026-08-12T07:00:00+03:00');
  assert.equal(again[again.length - 1].ts, '2026-08-12T18:00:00+03:00');
});

test('sorting keeps records with an empty timestamp instead of dropping them', () => {
  const recs = occ.parse(JSON.stringify([
    { ts: '2026-08-12T09:00:00', total: 5, occupied: 1 },
    { total: 5, occupied: 2 },
  ]));
  assert.equal(recs.length, 2);
  assert.equal(recs[0].ts, '');
  assert.equal(recs[1].ts, '2026-08-12T09:00:00');
});
