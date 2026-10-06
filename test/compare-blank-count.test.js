// A blank inspector field is a missing count, not a count of zero.
//
// Both entry paths on pilot-compare.html hand the library the raw value of a
// <input type="number">, whose .value is '' when the field is empty or holds
// something unparseable. Number('') is 0, so before this guard a double click
// on "add pair" (the inspector field is cleared after every save) or a "save
// pair" on a pending row with nothing typed stored a pair claiming the
// inspector saw 0 occupied spots, with a convincing accuracy figure.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const occ = require('../src/lib/occupancy');
const cmp = require('../src/lib/compare');

const base = { ts: '2026-08-12T08:00:00', street: 'הרצל', total: 12, systemOccupied: 5 };

test('a blank inspector count is rejected instead of being saved as zero', () => {
  assert.equal(cmp.pairObservation({ ...base, manualOccupied: '' }), null);
  assert.equal(cmp.pairObservation({ ...base, manualOccupied: '   ' }), null);
  assert.equal(cmp.pairObservation({ ...base, manualOccupied: null }), null);
  assert.equal(cmp.pairObservation({ ...base, manualOccupied: undefined }), null);
});

test('a blank system count or total is rejected too', () => {
  assert.equal(cmp.pairObservation({ ...base, systemOccupied: '', manualOccupied: 4 }), null);
  assert.equal(cmp.pairObservation({ ...base, total: '', manualOccupied: 4 }), null);
  assert.equal(cmp.pairObservation({ ...base, total: null, manualOccupied: 4 }), null);
});

test('booleans and arrays are not counts', () => {
  assert.equal(cmp.pairObservation({ ...base, manualOccupied: true }), null);
  assert.equal(cmp.pairObservation({ ...base, manualOccupied: false }), null);
  assert.equal(cmp.pairObservation({ ...base, manualOccupied: [] }), null);
  assert.equal(cmp.pairObservation({ ...base, manualOccupied: [3] }), null);
});

test('an explicit zero is still a real inspector count', () => {
  const p = cmp.pairObservation({ ...base, manualOccupied: 0 });
  assert.ok(p);
  assert.equal(p.manualOccupied, 0);
  assert.equal(p.accuracy, occ.inspectorAccuracy(5, 0, 12));
  const fromField = cmp.pairObservation({ ...base, manualOccupied: '0' });
  assert.ok(fromField);
  assert.equal(fromField.manualOccupied, 0);
});

test('numeric strings from the form still parse like numbers', () => {
  const p = cmp.pairObservation({ ts: 't', street: 'x', total: '12', systemOccupied: '5', manualOccupied: ' 4 ' });
  assert.ok(p);
  assert.equal(p.total, 12);
  assert.equal(p.systemOccupied, 5);
  assert.equal(p.manualOccupied, 4);
  assert.equal(p.accuracy, occ.inspectorAccuracy(5, 4, 12));
});

test('pairFromOccupancy with a blank inspector field yields no pair', () => {
  const rec = occ.normalize({ ts: '2026-08-12T08:00:00', street: 'הרצל', total: 12, occupied: 5, source: 'heuristic-brightness' });
  assert.equal(cmp.pairFromOccupancy(rec, '', ''), null);
  assert.equal(cmp.pairFromOccupancy(rec, null, ''), null);
  assert.ok(cmp.pairFromOccupancy(rec, '4', ''));
});

test('the pending-row save hands the raw field value to the library', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-compare.html'), 'utf8');
  assert.ok(html.indexOf('CMP.pairFromOccupancy(rec, inp.value, "")') !== -1);
  assert.equal(html.indexOf('Number(inp.value)'), -1);
});

test('the shipped sample series is unaffected', () => {
  const sample = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pilot', 'sample-pairs.json'), 'utf8'));
  assert.equal(sample.map(cmp.pairObservation).filter(Boolean).length, sample.length);
});
