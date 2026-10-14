const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const lot = require('../src/lib/atidim-lot');
const occ = require('../src/lib/occupancy');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

const htmlPath = path.join(root, 'demo', 'atidim.html');
const dataPath = path.join(root, 'demo', 'atidim-data.json');

test('Atidim lot model uses 18 bays and peaks in business hours', () => {
  assert.equal(lot.totalBays(lot.DEFAULT), 18);
  const morning = lot.stateAt(10, lot.DEFAULT);
  const night = lot.stateAt(3, lot.DEFAULT);
  assert.ok(morning.occupied > night.occupied);
  assert.equal(morning.free + morning.occupied, 18);
  assert.ok(morning.pct > 0.5 && morning.pct < 1);
  const bays = lot.bayStates(morning.occupied, morning.total);
  assert.equal(bays.length, 18);
  assert.equal(bays.filter(Boolean).length, morning.occupied);
});

test('hourly series feeds the shared occupancy chart (24 hours)', () => {
  const series = lot.hourlySeries(lot.DEFAULT);
  assert.equal(series.length, 24);
  const svg = occ.chartSvg(series, { width: 400, height: 120 });
  assert.match(svg, /class="chart"/);
  assert.ok(occ.byHour(series).some((b) => b.count === 1 && b.avg != null));
});

test('bay layout is a stable scatter that only grows as the lot fills', () => {
  const total = lot.totalBays(lot.DEFAULT);
  const at = (k) => lot.bayLayout(k, total);
  assert.deepEqual(at(7), at(7), 'same inputs, same lot — screenshots stay reproducible');
  assert.equal(at(7).filter(Boolean).length, 7);
  assert.equal(at(0).filter(Boolean).length, 0);
  assert.equal(at(total).filter(Boolean).length, total);
  // Not a solid block from bay 1 — that reads as obviously fake on screen.
  assert.notDeepEqual(at(7), lot.bayStates(7, total));
  // Monotone, so scrubbing the hour makes cars arrive instead of teleport.
  for (let k = 1; k < total; k++) {
    const prev = at(k - 1);
    const next = at(k);
    prev.forEach((occupied, i) => {
      if (occupied) assert.equal(next[i], true, `bay ${i} emptied between ${k - 1} and ${k}`);
    });
  }
  assert.deepEqual(lot.bayLayout(5, 0), []);
  assert.deepEqual(lot.bayLayout(NaN, 4), [false, false, false, false]);
});

test('snapshotAt renders any hour; liveSnapshot is that hour from the clock', () => {
  const quiet = lot.snapshotAt(3, lot.DEFAULT);
  const busy = lot.snapshotAt(10, lot.DEFAULT);
  assert.ok(busy.occupied > quiet.occupied);
  for (const snap of [quiet, busy]) {
    assert.equal(snap.bays.length, 18);
    assert.equal(snap.bays.filter(Boolean).length, snap.occupied);
    assert.equal(snap.free + snap.occupied, snap.total);
    assert.equal(snap.cols * snap.rows, 18);
    assert.match(snap.site, /עתידים/);
  }
  // 2026-10-19 07:30Z is 10:30 in Jerusalem.
  const live = lot.liveSnapshot(new Date('2026-10-19T07:30:00Z'), lot.DEFAULT);
  assert.deepEqual(live, lot.snapshotAt(10, lot.DEFAULT));
});

test('chart marker calls out one hour and is opt-in', () => {
  const series = lot.hourlySeries(lot.DEFAULT);
  const plain = occ.chartSvg(series, { width: 400, height: 120 });
  assert.doesNotMatch(plain, /stroke-dasharray/, 'no marker unless asked for');
  const marked = occ.chartSvg(series, { width: 400, height: 120, markIndex: 10 });
  assert.match(marked, /stroke-dasharray="4 4"/);
  assert.match(marked, /<circle/);
  // Out-of-range or missing index must not draw a stray marker.
  for (const bad of [-1, 24, 1.5, null, undefined, 'x']) {
    assert.doesNotMatch(occ.chartSvg(series, { markIndex: bad }), /stroke-dasharray/, String(bad));
  }
});

test('Hebrew RTL operator demo page is offline-safe and meeting-ready', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  assert.equal(data.cols * data.rows, 18);
  assert.match(html, /lang="he"/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /class="banner"/);
  assert.match(html, /id="bayCanvas"/);
  assert.match(html, /id="kFree"/);
  assert.match(html, /id="kOccPct"/);
  assert.match(html, /id="hourlyChart"/);
  assert.match(html, /id="kTotal"/);
  // Presenter controls: scrub the day, then jump back to the real hour.
  assert.match(html, /id="hourRange"[^>]*type="range"/);
  assert.match(html, /id="nowBtn"/);
  assert.match(html, /max="23"/);
  assert.match(html, /לא נשמרות לוחיות|אין שמירת לוחיות/);
  assert.match(html, /לא נשמר וידאו|אין שמירת וידאו/);
  assert.match(html, /עיבוד בקצה|בקצה המצלמה/);
  assert.doesNotMatch(html, /unpkg|cdnjs|googleapis/i);
  assert.match(html, /src\/lib\/atidim-lot\.js/);
  assert.match(html, /fetch\(\s*["']atidim-data\.json["']\s*\)/);
});

test('service worker precaches the Atidim demo shell', () => {
  const block = sw.slice(sw.indexOf('const ASSETS'), sw.indexOf('];') + 2);
  const assets = [...block.matchAll(/'(\.\/[^']*)'/g)].map((m) => m[1]);
  assert.ok(assets.includes('./demo/atidim.html'));
  assert.ok(assets.includes('./demo/atidim-data.json'));
  assert.ok(assets.includes('./src/lib/atidim-lot.js'));
  for (const rel of ['./demo/atidim.html', './demo/atidim-data.json', './src/lib/atidim-lot.js']) {
    assert.ok(fs.existsSync(path.join(root, rel.replace(/^\.\//, ''))), rel);
  }
});
