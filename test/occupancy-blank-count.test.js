const test = require('node:test');
const assert = require('node:assert/strict');
const occ = require('../src/lib/occupancy');

test('a blank occupied cell falls back to occupancyRate instead of reading as zero', () => {
  const r = occ.normalize({ ts: '2026-10-01T09:00', total: 10, occupied: '', occupancyRate: 0.8 });
  assert.equal(r.occupied, 8);
  const ws = occ.normalize({ ts: 't', total: 10, occupied: '   ', occupancyRate: 80 });
  assert.equal(ws.occupied, 8);
});

test('a blank occupied cell with no rate drops the record', () => {
  assert.equal(occ.normalize({ ts: 't', total: 10, occupied: '' }), null);
  assert.deepEqual(occ.parse('{"ts":"t","total":10,"occupied":""}\n'), []);
});

test('booleans and arrays are not counts', () => {
  assert.equal(occ.normalize({ ts: 't', total: 10, occupied: true }), null);
  assert.equal(occ.normalize({ ts: 't', total: true, occupied: 1 }), null);
  assert.equal(occ.normalize({ ts: 't', total: 10, occupied: [] }), null);
});

test('numeric strings and a blank confidence still parse', () => {
  const r = occ.normalize({ ts: 't', total: '12', occupied: ' 4 ', confidence: '' });
  assert.equal(r.total, 12);
  assert.equal(r.occupied, 4);
  assert.equal(r.confidence, 0);
});
