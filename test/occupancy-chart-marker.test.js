// chartSvg's opt-in `markIndex`: the dashed rule + dot that ties the curve to
// the hour the stat tiles are showing.
const test = require('node:test');
const assert = require('node:assert/strict');
const occ = require('../src/lib/occupancy');

// A plain weekday-ish series. 24 records so an index is unambiguous.
const series = Array.from({ length: 24 }, (_, h) => ({
  ts: `2026-10-18T${String(h).padStart(2, '0')}:00:00`,
  street: 'פארק עתידים',
  total: 18,
  occupied: h < 6 || h >= 22 ? 2 : 6 + (h % 7),
}));

const opts = { width: 400, height: 120 };
// The path is "M<x>,<y> L<x>,<y> …" — pull out the k-th point to check the dot
// lands on the curve instead of near it.
const curvePoint = (svg, k) => svg.match(/ d="([^"]+)"/)[1].split(' ')[k].slice(1);
const dot = (svg) => {
  const m = svg.match(/<circle cx="([^"]+)" cy="([^"]+)"/);
  return m && `${m[1]},${m[2]}`;
};

test('no marker unless a chart asks for one', () => {
  const svg = occ.chartSvg(series, opts);
  assert.doesNotMatch(svg, /stroke-dasharray/);
  assert.doesNotMatch(svg, /<circle/);
});

test('markIndex draws a dashed rule and a dot on that record', () => {
  const svg = occ.chartSvg(series, { ...opts, markIndex: 10 });
  assert.match(svg, /stroke-dasharray="4 4"/);
  assert.equal(dot(svg), curvePoint(svg, 10), 'the dot sits on the curve, not beside it');
  // One marker, not one per record.
  assert.equal(svg.match(/<circle/g).length, 1);
});

test('the marker takes the chart stroke so it reads as the same series', () => {
  const svg = occ.chartSvg(series, { ...opts, markIndex: 3, stroke: '#b91c1c' });
  assert.match(svg, /<circle [^>]*fill="#b91c1c"/);
  assert.match(svg, /stroke-dasharray="4 4"[^>]*\/>/);
  assert.equal(svg.match(/#0e7490/g), null, 'no leftover default teal');
});

test('an index off the series, or not an index at all, draws nothing', () => {
  // null is the one that bites: Number(null) is 0, so a coerced guard would
  // mark midnight on every chart that passes a missing index through.
  for (const bad of [-1, 24, 99, 1.5, NaN, Infinity, null, undefined, 'x', '10', true, {}]) {
    const svg = occ.chartSvg(series, { ...opts, markIndex: bad });
    assert.doesNotMatch(svg, /stroke-dasharray/, String(bad));
    assert.doesNotMatch(svg, /<circle/, String(bad));
  }
});

test('marking the only record of a one-row chart still works', () => {
  const svg = occ.chartSvg([series[9]], { ...opts, markIndex: 0 });
  assert.equal(dot(svg), curvePoint(svg, 0));
  // An empty series has no chart to mark at all.
  assert.equal(occ.chartSvg([], { ...opts, markIndex: 0 }), '');
});

test('a markable record with no usable count marks the zero line', () => {
  const holed = series.map((r, i) => (i === 10 ? { ...r, occupied: null } : r));
  const svg = occ.chartSvg(holed, { ...opts, markIndex: 10 });
  assert.equal(dot(svg), curvePoint(svg, 10), 'marker and curve agree on the gap');
});
