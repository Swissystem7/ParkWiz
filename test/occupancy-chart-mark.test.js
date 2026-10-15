// chartSvg({ markIndex }) calls out one record on the curve. The operator
// pages show live counters next to the hourly curve, and without the marker a
// viewer has to guess which point on the curve the counters are standing on.
// Opt-in: every existing caller passes no markIndex and must get the old SVG.
const test = require('node:test');
const assert = require('node:assert/strict');
const occ = require('../src/lib/occupancy');

// A plain 24-hour day, the shape the pilot pages feed the chart.
const day = Array.from({ length: 24 }, (_, h) => ({
  ts: `2026-10-18T${String(h).padStart(2, '0')}:00:00`,
  street: 'בדיקה',
  total: 20,
  occupied: h >= 8 && h < 18 ? 14 : 3,
}));

const dashes = (svg) => [...svg.matchAll(/stroke-dasharray="4 4"/g)].length;

test('no markIndex leaves the curve exactly as it was', () => {
  const plain = occ.chartSvg(day, { width: 400, height: 120 });
  assert.match(plain, /class="chart"/);
  assert.equal(dashes(plain), 0);
  assert.doesNotMatch(plain, /<circle/);
});

test('markIndex draws one dashed line and one dot, at that record', () => {
  const marked = occ.chartSvg(day, { width: 400, height: 120, markIndex: 10 });
  assert.equal(dashes(marked), 1, 'one marker, not one per record');
  assert.equal([...marked.matchAll(/<circle/g)].length, 1);
  // The dot sits on the curve: same y as the path point for that record.
  const cy = Number(marked.match(/<circle cx="([\d.]+)" cy="([\d.]+)"/)[2]);
  const cx = Number(marked.match(/<circle cx="([\d.]+)"/)[1]);
  const point = marked.match(/ d="([^"]+)"/)[1].split(' ')[10].slice(1).split(',');
  assert.equal(cx, Number(point[0]));
  assert.equal(cy, Number(point[1]));
});

test('the marker moves with the index', () => {
  const at = (i) => occ.chartSvg(day, { markIndex: i }).match(/<circle cx="([\d.]+)"/)[1];
  assert.notEqual(at(3), at(16));
  assert.equal(at(3), at(3));
});

test('the marker takes the caller stroke so it matches the curve', () => {
  const svg = occ.chartSvg(day, { markIndex: 5, stroke: 'var(--brand)' });
  assert.match(svg, /stroke="var\(--brand\)" stroke-width="1" stroke-dasharray="4 4"/);
  assert.match(svg, /<circle[^>]*fill="var\(--brand\)"/);
});

test('an out-of-range or non-integer markIndex draws nothing', () => {
  // Number(null) is 0, so a nullish option must not quietly mark midnight.
  for (const bad of [-1, 24, 99, 1.5, NaN, null, undefined, '10', true, {}]) {
    const svg = occ.chartSvg(day, { markIndex: bad });
    assert.equal(dashes(svg), 0, String(bad));
    assert.doesNotMatch(svg, /<circle/, String(bad));
  }
});

test('an empty record list still returns no chart at all', () => {
  assert.equal(occ.chartSvg([], { markIndex: 0 }), '');
});
