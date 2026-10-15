const test = require('node:test');
const assert = require('node:assert/strict');
const occ = require('../src/lib/occupancy');

const labels = (svg) => [...svg.matchAll(/>(\d{2}:00|\d+)<\/text>/g)].map((m) => m[1]).filter((s) => s.includes(':'));

test('chartSvg labels the hour as recorded, whatever the timezone', () => {
  const svg = occ.chartSvg([
    { ts: '2026-08-12T08:00:00Z', total: 10, occupied: 3 },
    { ts: '2026-08-12T17:30:00+03:00', total: 10, occupied: 8 },
  ]);
  assert.deepEqual(labels(svg), ['08:00', '17:00']);
});

test('chartSvg agrees with the heatmap hour', () => {
  const ts = '2026-08-12T23:15:00-05:00';
  const svg = occ.chartSvg([{ ts, total: 4, occupied: 1 }]);
  assert.deepEqual(labels(svg), [String(occ.hourFromTs(ts)).padStart(2, '0') + ':00']);
});

test('chartSvg falls back to the row number without a recorded hour', () => {
  const svg = occ.chartSvg([{ ts: 'not-a-time', total: 4, occupied: 1 }]);
  assert.ok(svg.includes('>1</text>'));
  assert.deepEqual(labels(svg), []);
});
