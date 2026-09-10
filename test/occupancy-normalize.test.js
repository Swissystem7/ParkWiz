// Backlog item 1: "normalize must reject any record whose ts is not short ISO
// YYYY-MM-DDTHH:MM".
//
// The item is NOT implemented as written, and this file is the reason. The
// schema's ts is free-form by specification, and the pre-existing suite says
// so in three files: test/occupancy.test.js normalises records stamped 't',
// 'a' and 'b' and full ISO with seconds, test/compare.test.js normalises
// '2026-08-12T08:00:00', test/export.test.js round-trips records stamped
// '...T08:00:00+03:00'. Applying the strict rule in a throwaway copy of the
// worktree fails 7 pre-existing tests. Those tests are the specification.
//
// What is implemented is the half of the item that costs nothing: a ts that
// claims to be a timestamp and is impossible is rejected. Every case below was
// decided from the calendar by hand before the code was written.
const test = require('node:test');
const assert = require('node:assert/strict');
const occ = require('../src/lib/occupancy');

const REC = { street: 'הרצל', total: 12, occupied: 4, source: 'sample', confidence: 0.2 };
const withTs = (ts) => Object.assign({ ts }, REC);

test('short ISO is accepted, and so is every longer legal ISO shape', () => {
  for (const ts of [
    '2026-08-12T08:00',
    '2026-08-12T08:00:00',
    '2026-08-12T08:00:00Z',
    '2026-08-12T08:00:00+03:00',
    '2026-08-12T08:00:00.250Z',
    '2026-08-12',
    '2024-02-29T23:59',
  ]) {
    const r = occ.normalize(withTs(ts));
    assert.ok(r, ts + ' should be accepted');
    assert.equal(r.ts, ts);
    assert.equal(occ.tsProblem(ts), null);
  }
});

test('the free-form stamps the rest of the suite relies on still pass', () => {
  // These are the exact values test/occupancy.test.js feeds normalize. If this
  // test ever goes red, the strict rule crept in and broke the schema contract.
  for (const ts of ['t', 'a', 'b', '', 'unknown', 'בוקר']) {
    assert.ok(occ.normalize(withTs(ts)), JSON.stringify(ts) + ' should be accepted');
    assert.equal(occ.tsProblem(ts), null);
  }
  assert.ok(occ.normalize({ street: 'הרצל', total: 12, occupied: 4 }), 'a missing ts is accepted');
});

test('a date that never happened is rejected', () => {
  for (const ts of [
    '2026-02-30T08:00',
    '2026-04-31T08:00',
    '2026-13-01T08:00',
    '2026-00-10T08:00',
    '2026-08-00T08:00',
    '2026-08-32T08:00',
    '2026-02-29T08:00',
    '1900-02-29T08:00',
  ]) {
    assert.equal(occ.normalize(withTs(ts)), null, ts + ' should be rejected');
    assert.equal(occ.tsProblem(ts), 'impossible-date');
  }
});

test('a clock that cannot exist is rejected', () => {
  for (const ts of ['2026-08-12T24:00', '2026-08-12T25:30', '2026-08-12T99:00', '2026-08-12T08:60']) {
    assert.equal(occ.normalize(withTs(ts)), null, ts + ' should be rejected');
    assert.equal(occ.tsProblem(ts), 'impossible-clock');
  }
  // the boundary values on either side of the cut
  assert.ok(occ.normalize(withTs('2026-08-12T23:59')));
  assert.equal(occ.normalize(withTs('2026-08-12T24:00')), null);
});

test('an impossible timestamp is dropped, not repaired into a record', () => {
  // The record is otherwise perfect: only the ts is wrong.
  const bad = occ.normalize({ ts: '2026-02-30T08:00', street: 'הרצל', total: 12, occupied: 4 });
  assert.equal(bad, null);
  const good = occ.normalize({ ts: '2026-03-02T08:00', street: 'הרצל', total: 12, occupied: 4 });
  assert.equal(good.occupied, 4);
  // 2026-02-30 is exactly what Date.UTC would have rolled into 2026-03-02.
  // The point of the rejection is that the two are not the same record.
  assert.equal(occ.weekdayFromTs('2026-03-02'), 1);
  assert.equal(occ.weekdayFromTs('2026-02-30'), null);
});

test('parse drops the impossible records and keeps the rest, ts-sorted', () => {
  const text = JSON.stringify([
    { ts: '2026-08-12T10:00', street: 'הרצל', total: 10, occupied: 8, source: 'sample' },
    { ts: '2026-02-30T09:00', street: 'הרצל', total: 10, occupied: 5, source: 'sample' },
    { ts: '2026-08-12T08:00', street: 'הרצל', total: 10, occupied: 3, source: 'sample' },
    { ts: '2026-08-12T24:00', street: 'הרצל', total: 10, occupied: 9, source: 'sample' },
    { ts: '2026-08-12T09:00', street: 'הרצל', total: 10, occupied: 6, source: 'sample' },
  ]);
  const recs = occ.parse(text);
  assert.equal(recs.length, 3);
  assert.deepEqual(recs.map((r) => r.ts), ['2026-08-12T08:00', '2026-08-12T09:00', '2026-08-12T10:00']);
  assert.deepEqual(recs.map((r) => r.occupied), [3, 6, 8]);
});

test('the two encodings of one series parse to exactly the same records', () => {
  // parse() used to sort the JSONL path and leave the JSON-array path in input
  // order, so the same three observations read back differently depending on
  // how they had been written down. Both are ts-sorted now.
  const rows = [
    { ts: '2026-08-12T10:00', street: 'הרצל', total: 10, occupied: 8 },
    { ts: '2026-13-01T08:00', street: 'הרצל', total: 10, occupied: 4 },
    { ts: '2026-08-12T08:00', street: 'הרצל', total: 10, occupied: 3 },
    { ts: '2026-08-12T09:00', street: 'הרצל', total: 10, occupied: 5 },
  ];
  const fromArray = occ.parse(JSON.stringify(rows));
  const fromJsonl = occ.parse(rows.map((r) => JSON.stringify(r)).join('\n'));
  assert.equal(fromArray.length, 3);
  assert.deepEqual(fromArray, fromJsonl);
  assert.deepEqual(fromArray.map((r) => r.occupied), [3, 5, 8]);
});

test('the shipped sample series survives the tightening unchanged', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const raw = fs.readFileSync(path.join(__dirname, '..', 'pilot', 'sample-occupancy.json'), 'utf8');
  const recs = occ.parse(raw);
  assert.equal(recs.length, JSON.parse(raw).length);
  assert.ok(recs.length > 0);
  for (const r of recs) assert.equal(occ.tsProblem(r.ts), null);
});
