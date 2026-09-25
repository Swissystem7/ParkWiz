const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const occ = require('../src/lib/occupancy');
const cmp = require('../src/lib/compare');

const samplePairs = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'pilot', 'sample-pairs.json'), 'utf8')
);

test('pairObservation uses inspectorAccuracy and clamps to total', () => {
  const p = cmp.pairObservation({
    ts: 't', street: 'הרצל', total: 10, systemOccupied: 7, manualOccupied: 5,
  });
  assert.equal(p.accuracy, occ.inspectorAccuracy(7, 5, 10));
  assert.equal(p.accuracy, 0.8);
  const over = cmp.pairObservation({ total: 10, systemOccupied: 99, manualOccupied: -1 });
  assert.equal(over.systemOccupied, 10);
  assert.equal(over.manualOccupied, 0);
  assert.equal(over.accuracy, 0);
});

test('bad pairs are rejected', () => {
  assert.equal(cmp.pairObservation(null), null);
  assert.equal(cmp.pairObservation({ total: 0, systemOccupied: 1, manualOccupied: 1 }), null);
  assert.equal(cmp.pairObservation({ total: 10, systemOccupied: 'x', manualOccupied: 1 }), null);
  assert.equal(cmp.parsePairs('{"foo":1}').length, 0);
});

test('an empty or pair-less file keeps the saved pairs', () => {
  const saved = samplePairs.map(cmp.pairObservation);
  assert.equal(saved.length, 14);
  assert.deepEqual(cmp.parsePairs(''), []);
  for (const text of ['', '   \n', '[]', '{"foo":1}', 'not json']) {
    const res = cmp.replacePairsFromText(saved, text);
    assert.equal(res.replaced, false, JSON.stringify(text));
    assert.equal(res.count, 0);
    assert.equal(res.pairs, saved);
    assert.equal(res.pairs.length, 14);
  }
  const res = cmp.replacePairsFromText(saved, JSON.stringify(samplePairs.slice(0, 3)));
  assert.equal(res.replaced, true);
  assert.equal(res.count, 3);
  assert.equal(res.pairs.length, 3);
});

test('comparison page does not overwrite pairs when a loaded file has none', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-compare.html'), 'utf8');
  const handler = html.slice(html.indexOf('getElementById("filePairs").addEventListener'));
  const body = handler.slice(0, handler.indexOf('\n});'));
  assert.match(body, /replacePairsFromText\(pairs,/);
  assert.match(body, /if \(!res\.replaced\)[\s\S]*?setStatus\("addStatus"[\s\S]*?return;/);
  assert.doesNotMatch(body, /pairs = CMP\.parsePairs/);
});

test('pairFromOccupancy copies the heuristic record into a pair', () => {
  const rec = occ.normalize({ ts: '2026-08-12T08:00:00', street: 'הרצל', total: 12, occupied: 5, source: 'heuristic-brightness' });
  const p = cmp.pairFromOccupancy(rec, 4, 'פקח א׳');
  assert.equal(p.systemOccupied, 5);
  assert.equal(p.manualOccupied, 4);
  assert.equal(p.note, 'פקח א׳');
  assert.equal(p.source, 'heuristic-brightness');
});

test('summarizePairs reports mean accuracy, error, and sample-only', () => {
  const pairs = samplePairs.map(cmp.pairObservation);
  assert.equal(pairs.length, 14);
  const s = cmp.summarizePairs(pairs);
  assert.equal(s.count, 14);
  assert.equal(s.perfect, 8);
  assert.ok(Math.abs(s.meanAccuracy - 13.5 / 14) < 1e-12);
  assert.ok(Math.abs(s.meanAbsError - 6 / 14) < 1e-12);
  assert.equal(s.minAccuracy, 1 - 1 / 12);
  assert.equal(s.maxAccuracy, 1);
  assert.equal(s.sampleOnly, true);
  assert.ok(Math.abs(s.meanSignedError - 4 / 14) < 1e-12);
});

test('surface nav exposes the comparison page', () => {
  const nav = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'surface-nav.js'), 'utf8');
  assert.match(nav, /pilot-compare\.html/);
  assert.match(nav, /השוואת דיוק/);
  assert.match(nav, /pilot-log\.html/);
  assert.match(nav, /pilot-brief\.html/);
  assert.match(nav, /offer\.html/);
});

test('an empty series has no accuracy to report', () => {
  const s = cmp.summarizePairs([]);
  assert.equal(s.count, 0);
  assert.equal(s.meanAccuracy, null);
  assert.equal(s.meanSignedError, null);
  assert.equal(s.sampleOnly, false);
});
