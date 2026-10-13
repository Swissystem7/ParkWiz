// demo/atidim.html is the first surface outside the repo root, so it needs the
// shared nav's data-base and its own entry in the offline shell. It is also the
// one page shown live in front of someone, which is why the traps are asserted
// to still fail: a demo that quietly becomes a success reel is worse than none.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const demo = read('demo/atidim.html');

test('the demo page is Hebrew RTL with a skip link, an honesty banner and no CDN', () => {
  assert.match(demo, /lang="he"/);
  assert.match(demo, /dir="rtl"/);
  assert.match(demo, /class="skip-link"/);
  assert.match(demo, /class="banner"/);
  assert.doesNotMatch(demo, /unpkg|cdnjs|googleapis/i);
  // Subdirectory surface: every shared asset is reached with ../
  for (const asset of [
    '../pilot/shell.css', '../pilot/print.css', '../manifest.json', '../icon.svg',
    '../src/lib/heuristic.js', '../src/lib/dataset.js', '../src/lib/surface-nav.js',
  ]) {
    assert.ok(demo.includes(asset), `demo page must load ${asset} relative to the root`);
  }
});

test('the demo banner says the frames are synthetic and the operator is not a customer', () => {
  assert.match(demo, /הפריימים האלה מסונתזים בקוד/);
  assert.match(demo, /<b>לא<\/b> חניון אמיתי/);
  assert.match(demo, /<b>יעד פגישה, לא לקוח<\/b>/);
  assert.match(demo, /דיוק מול ספירה ידנית בשטח עדיין לא נמדד/);
  assert.match(demo, /אין כאן זיהוי לוחיות/);
  // The KPI must not read as inspector agreement.
  assert.match(demo, /הסכמה מול התוויות \(לא פקח\)/);
  // A named prospect is a meeting target, not a reference customer.
  assert.doesNotMatch(demo, /עתידים|CityZone/);
});

test('the demo page shows the five script steps and the failure traps', () => {
  for (const label of ['פתיחה', 'תפוס / פנוי', 'תאורה', 'איפה זה נשבר', 'מה מקבלים']) {
    assert.ok(demo.includes(label), `missing demo step: ${label}`);
  }
  assert.match(demo, /מלכודת: צל על מקום ריק/);
  assert.match(demo, /מלכודת: רכב בצבע אספלט/);
  assert.match(demo, /trap: true/);
});

test('the demo scene ids all exist in the synthetic dataset', () => {
  const DS = require('../src/lib/dataset.js');
  const known = new Set(DS.SCENE_DEFS.map((d) => d.id));
  const block = demo.slice(demo.indexOf('const DEMO_SCENES'), demo.indexOf('const STEPS'));
  const ids = [...block.matchAll(/id: "([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, 7, 'the meeting walks seven conditions');
  for (const id of ids) assert.ok(known.has(id), `scene "${id}" is not in dataset.js`);

  // Same for the step scenes, which drive renderScene() directly.
  const stepBlock = demo.slice(demo.indexOf('const STEPS'), demo.indexOf('const LIGHT_HE'));
  for (const m of stepBlock.matchAll(/scene: "([^"]+)"/g)) {
    assert.ok(known.has(m[1]), `step scene "${m[1]}" is not in dataset.js`);
  }
});

test('the traps really do fail, so the demo cannot quietly become a success reel', () => {
  const DS = require('../src/lib/dataset.js');
  const scenes = new Map(DS.scenes().map((s) => [s.id, s]));
  for (const id of ['shadow-false', 'camouflage-day']) {
    const report = DS.evaluateScene(scenes.get(id), 'v2');
    assert.ok(report.rate < 1, `${id} is shown as a trap but now agrees perfectly`);
  }
  // And the happy path is still worth demoing.
  const day = DS.evaluateScene(scenes.get('day-mixed'), 'v2');
  assert.equal(day.n, DS.SPOT_COUNT);
  assert.ok(day.rate >= 0.5, `the day scene should mostly agree, got ${day.rate}`);
});

test('the shared nav carries the demo once, with a base for the subdirectory', () => {
  delete require.cache[require.resolve('../src/lib/surface-nav.js')];
  require('../src/lib/surface-nav.js');
  const { LINKS, resolveHref } = globalThis.ParkWizSurfaceNav;
  const link = LINKS.find((l) => l.id === 'atidim');
  assert.ok(link, 'nav needs an atidim entry');
  assert.equal(link.href, './demo/atidim.html');
  // A private lot that is only a meeting target must not be sold as a customer
  // in the public nav label.
  assert.doesNotMatch(link.label, /עתידים|CityZone/);

  assert.match(demo, /id="pwSurfaceNav" data-active="atidim" data-base="\.\.\/"/);
  assert.equal(resolveHref('./', '../'), '../');
  assert.equal(resolveHref('./pilot-kit.html', '../'), '../pilot-kit.html');
  assert.equal(resolveHref('./pilot-kit.html', ''), './pilot-kit.html');
});

test('the operator demo is part of the offline shell and the cache was bumped', () => {
  const sw = read('sw.js');
  assert.match(sw, /'\.\/demo\/atidim\.html'/);
  const v = Number(sw.match(/parkwiz-field-v(\d+)/)[1]);
  assert.ok(v >= 10, 'adding demo/atidim.html to ASSETS requires a cache bump');
  // The page is deliberately fetch-free so it works from file:// in a meeting.
  assert.doesNotMatch(demo, /fetch\(/);
});

test('README points a reader at the operator demo', () => {
  assert.match(read('README.md'), /demo\/atidim\.html/);
});
