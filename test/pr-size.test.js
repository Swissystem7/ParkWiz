const test = require('node:test');
const assert = require('node:assert/strict');
const prSize = require('../src/lib/pr-size');

const NUMSTAT = [
  '61\t48\tindex.html',
  '100\t0\tsrc/lib/contact.js',
  '101\t0\ttest/contact.test.js',
  '-\t-\tnetanya-lots.geojson',
  '44\t0\tdocs/launch/PITCH.md',
].join('\n');

test('parses numstat, counts both sides, and treats binary files as zero', () => {
  const files = prSize.parseNumstat(NUMSTAT);
  assert.equal(files.length, 5);
  assert.deepEqual(files[0], {
    path: 'index.html', added: 61, deleted: 48, changed: 109, binary: false,
  });
  const geo = files.find((f) => f.path === 'netanya-lots.geojson');
  assert.equal(geo.binary, true);
  assert.equal(geo.changed, 0);
  assert.equal(prSize.totalChanged(files), 109 + 100 + 101 + 44);
  assert.deepEqual(prSize.parseNumstat(''), []);
  assert.deepEqual(prSize.parseNumstat(null), []);
});

test('reads the new path out of a rename', () => {
  const braced = prSize.parseNumstat('2\t2\tdocs/{old => launch}/PITCH.md');
  assert.equal(braced[0].path, 'docs/launch/PITCH.md');
  const plain = prSize.parseNumstat('2\t2\tOUTREACH.md => docs/launch/OUTREACH.md');
  assert.equal(plain[0].path, 'docs/launch/OUTREACH.md');
});

test('a test file joins the module it reviews, even with a dashed suffix', () => {
  const changed = new Set([
    'src/lib/compare.js', 'test/compare-frame-number.test.js', 'test/offer-price-anchor.test.js',
  ]);
  assert.equal(prSize.unitKey('src/lib/compare.js', changed), 'lib:compare');
  assert.equal(prSize.unitKey('test/compare-frame-number.test.js', changed), 'lib:compare');
  // src/lib/offer.js is untouched here, so its test stands on its own.
  assert.equal(prSize.unitKey('test/offer-price-anchor.test.js', changed), 'test:offer-price-anchor');
});

test('pages, docs, CI and the PWA shell each get their own unit', () => {
  const none = new Set();
  assert.equal(prSize.unitKey('pilot-compare.html', none), 'page:pilot-compare');
  assert.equal(prSize.unitKey('docs/launch/PITCH.md', none), 'docs:launch');
  assert.equal(prSize.unitKey('README.md', none), 'docs:README');
  assert.equal(prSize.unitKey('.github/workflows/validate.yml', none), 'ci:workflows');
  assert.equal(prSize.unitKey('sw.js', none), 'pwa');
  assert.equal(prSize.unitKey('manifest.json', none), 'pwa');
  assert.equal(prSize.unitKey('netanya-lots.geojson', none), 'other:netanya-lots.geojson');
});

test('a diff inside the budget is left as one PR', () => {
  const plan = prSize.planSplit(prSize.parseNumstat(NUMSTAT));
  assert.equal(plan.limit, 400);
  assert.equal(plan.total, 354);
  assert.match(prSize.formatPlan(plan), /Within budget/);
});

test('an over-budget diff splits into parts that each fit, with modules and tests together', () => {
  const files = prSize.parseNumstat([
    '150\t0\tsrc/lib/contact.js',
    '150\t0\ttest/contact.test.js',
    '180\t20\tdocs/launch/PILOT-KIT.md',
    '140\t60\tindex.html',
    '30\t0\toffer.html',
  ].join('\n'));
  const plan = prSize.planSplit(files);
  assert.equal(plan.total, 730);
  assert.ok(plan.parts.length >= 2);
  plan.parts.forEach((part) => assert.ok(part.changed <= 400, `${part.changed} <= 400`));
  assert.equal(plan.oversized.length, 0);

  // Every file lands in exactly one part.
  const placed = plan.parts.flatMap((p) => p.files);
  assert.equal(placed.length, files.length);
  assert.equal(new Set(placed).size, files.length);

  const home = plan.parts.find((p) => p.files.includes('src/lib/contact.js'));
  assert.ok(home.files.includes('test/contact.test.js'));

  const report = prSize.formatPlan(plan);
  assert.match(report, /Over budget/);
  assert.match(report, /PR 1 — \d+ lines/);
});

test('a single unit over the budget is reported instead of packed', () => {
  const plan = prSize.planSplit(prSize.parseNumstat('500\t20\tindex.html'));
  assert.equal(plan.parts.length, 0);
  assert.deepEqual(plan.oversized.map((u) => u.key), ['page:index']);
  assert.match(prSize.formatPlan(plan), /commit-by-commit split/);
});

test('honours a custom limit', () => {
  const plan = prSize.planSplit(prSize.parseNumstat('40\t0\toffer.html\n40\t0\tindex.html'), {
    limit: 50,
  });
  assert.equal(plan.limit, 50);
  assert.equal(plan.parts.length, 2);
});
