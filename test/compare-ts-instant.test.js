const test = require('node:test');
const assert = require('node:assert/strict');
const cmp = require('../src/lib/compare');

const row = (ts, man) => JSON.stringify({ ts, street: 'הרצל', total: 10, systemOccupied: 5, manualOccupied: man });

test('parsePairs orders mixed-offset timestamps by instant, not by text', () => {
  // 07:30+03:00 is 04:30Z, so it comes before 05:00Z although it sorts after it as a string.
  const pairs = cmp.parsePairs([row('2026-08-12T05:00:00Z', 6), row('2026-08-12T07:30:00+03:00', 4)].join('\n'));
  assert.deepEqual(pairs.map((p) => p.ts), ['2026-08-12T07:30:00+03:00', '2026-08-12T05:00:00Z']);
});

test('a JSON array and JSONL with mixed offsets give the same order', () => {
  const rows = [row('2026-08-12T09:00:00Z', 5), row('2026-08-12T10:00:00+03:00', 6), row('2026-08-12T06:30:00Z', 4)];
  const fromLines = cmp.parsePairs(rows.join('\n'));
  const fromArray = cmp.parsePairs('[' + rows.join(',') + ']');
  assert.deepEqual(fromArray, fromLines);
  assert.deepEqual(fromLines.map((p) => p.manualOccupied), [4, 6, 5]);
});

test('undated pairs stay first, in string order, ahead of dated ones', () => {
  const pairs = cmp.parsePairs([row('2026-08-12T05:00:00Z', 6), row('', 3), row('2026-08-11T05:00:00Z', 2)].join('\n'));
  assert.deepEqual(pairs.map((p) => p.ts), ['', '2026-08-11T05:00:00Z', '2026-08-12T05:00:00Z']);
});

test('byTs breaks a same-instant tie by text so the order is stable', () => {
  const list = [{ ts: '2026-08-12T08:00:00+03:00' }, { ts: '2026-08-12T05:00:00Z' }];
  assert.deepEqual(list.slice().sort(cmp.byTs).map((p) => p.ts), ['2026-08-12T05:00:00Z', '2026-08-12T08:00:00+03:00']);
});
