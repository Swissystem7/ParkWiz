// parsePairs reads a file the operator picked on pilot-compare.html. Blank text means
// "no pairs in that file", not a programming error — replacePairsFromText must keep
// the pairs already in the browser (#60). normalizePack is what rejects blank input
// when there is nothing to normalize (#116). Conflating the two broke master CI in
// #117 and blocked the Park Atidim demo stack (#147, #167).
const test = require('node:test');
const assert = require('node:assert/strict');
const cmp = require('../src/lib/compare');

test('parsePairs returns no pairs for empty or whitespace-only input', () => {
  for (const blank of ['', '   ', '\t\n']) {
    assert.deepEqual(cmp.parsePairs(blank), []);
  }
});

test('parsePairs throws TypeError only for non-string input', () => {
  for (const bad of [null, undefined, 0, [], {}]) {
    assert.throws(() => cmp.parsePairs(bad), TypeError);
  }
});

test('blank or pair-less file text does not wipe saved pairs', () => {
  const saved = [
    {
      ts: '2026-08-12T08:00:00',
      street: 'הרצל',
      total: 10,
      systemOccupied: 5,
      manualOccupied: 5,
      accuracy: 1,
      note: '',
      source: 'paired',
    },
  ];
  for (const text of ['', '   \n', '[]', '{"foo":1}', 'not json']) {
    const res = cmp.replacePairsFromText(saved, text);
    assert.equal(res.replaced, false, JSON.stringify(text));
    assert.equal(res.count, 0);
    assert.equal(res.pairs, saved);
    assert.equal(res.pairs.length, 1);
  }
});

test('normalizePack still rejects blank input while parsePairs accepts it', () => {
  assert.deepEqual(cmp.parsePairs(''), []);
  for (const bad of [null, undefined, 0, '', ' ', '\t\n']) {
    assert.throws(() => cmp.normalizePack(bad), TypeError);
  }
});
