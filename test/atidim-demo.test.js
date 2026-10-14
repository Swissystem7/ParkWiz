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
