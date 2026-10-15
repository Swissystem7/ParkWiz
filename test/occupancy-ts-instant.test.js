const test = require('node:test');
const assert = require('node:assert/strict');
const occ = require('../src/lib/occupancy');
const cmp = require('../src/lib/compare');

const rec = (ts, occupied) => ({ ts, street: 'הרצל', total: 12, occupied, source: 'sample' });

test('parse orders mixed-offset timestamps by instant, not by text', () => {
  // The sample series is stamped +03:00; the kit stamps toISOString() (Z).
  // 14:00Z is 17:00 local, so it is later than 16:00+03:00 (13:00Z) although
  // it sorts before it as a string.
  const recs = occ.parse(JSON.stringify([rec('2026-08-12T16:00:00+03:00', 8), rec('2026-08-12T14:00:00Z', 3)]));
  assert.deepEqual(recs.map((r) => r.ts), ['2026-08-12T16:00:00+03:00', '2026-08-12T14:00:00Z']);
});

test('summarize prints the later kit reading as the current one', () => {
  const recs = occ.parse([
    JSON.stringify(rec('2026-08-12T14:00:00Z', 3)),
    JSON.stringify(rec('2026-08-12T16:00:00+03:00', 8)),
    JSON.stringify(rec('2026-08-12T07:00:00+03:00', 2)),
  ].join('\n'));
  const s = occ.summarize(recs);
  assert.equal(s.first.occupied, 2);
  assert.equal(s.last.occupied, 3);
});

test('a JSON array and JSONL with mixed offsets give the same order', () => {
  const rows = [rec('2026-08-12T09:00:00Z', 5), rec('2026-08-12T10:00:00+03:00', 6), rec('2026-08-12T06:30:00Z', 4)];
  const fromArray = occ.parse(JSON.stringify(rows));
  const fromLines = occ.parse(rows.map((r) => JSON.stringify(r)).join('\n'));
  assert.deepEqual(fromArray, fromLines);
  assert.deepEqual(fromLines.map((r) => r.occupied), [4, 6, 5]);
});

test('undated records stay first, in string order, ahead of dated ones', () => {
  const recs = occ.parse(JSON.stringify([rec('2026-08-12T05:00:00Z', 6), rec('', 3), rec('b', 1), rec('a', 2), rec('2026-08-11T05:00:00Z', 2)]));
  assert.deepEqual(recs.map((r) => r.ts), ['', 'a', 'b', '2026-08-11T05:00:00Z', '2026-08-12T05:00:00Z']);
});

test('byTs breaks a same-instant tie by text so the order is stable', () => {
  const list = [{ ts: '2026-08-12T08:00:00+03:00' }, { ts: '2026-08-12T05:00:00Z' }];
  assert.deepEqual(list.slice().sort(occ.byTs).map((r) => r.ts), ['2026-08-12T05:00:00Z', '2026-08-12T08:00:00+03:00']);
});

test('pairs and occupancy records share one ordering rule', () => {
  assert.equal(cmp.byTs, occ.byTs);
});
