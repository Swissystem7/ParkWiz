// The CityZone / Atidim operator meeting (issue #122) added two artefacts that
// are easy to break by accident: a briefing doc that must never grow a made-up
// accuracy number, and demo/atidim.html — the first surface outside the repo
// root, which therefore needs the shared nav's data-base and its own entry in
// the offline shell.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const brief = read('docs/launch/ATIDIM-MEETING.md');
const demo = read('demo/atidim.html');

test('the briefing covers all five sections the meeting needs', () => {
  for (const heading of [
    '## 1. סדר יום — 20 דקות',
    '## 2. שלושה יתרונות טכניים מול לולאות אינדוקטיביות ואולטרסוניק',
    '## 3. תסריט הדגמה חי — `demo/atidim.html`',
    '## 4. התנגדויות ושאלות — מענה',
    '## 5. מתווה פיילוט — שבועיים, 0 ₪',
  ]) {
    assert.ok(brief.includes(heading), `missing section: ${heading}`);
  }
  // The three technical advantages, each as its own named sub-section.
  assert.match(brief, /### יתרון 1 — בלי חציבת אספלט/);
  assert.match(brief, /### יתרון 2 — כיסוי מרחבי/);
  assert.match(brief, /### יתרון 3 — תובנות תנועה/);
  // A pitch that only lists its own advantages is not credible to an operator.
  assert.match(brief, /### הצד השני של הטבלה/);
});

test('the briefing claims no accuracy number and no customer relationship', () => {
  assert.match(brief, /עדיין בשלב מדידה/);
  assert.match(brief, /אין הסכם, אין לקוח משלם/);
  assert.doesNotMatch(brief, /דיוק של \d/, 'no invented accuracy figure');
  // Vendor accuracy claims may be quoted as vendor claims, never as ours.
  const ours = brief.replace(/הצהרות יצרנים \(Camlytics ~96%\) כאילו הן שלנו/g, '');
  assert.doesNotMatch(ours, /96%/, 'a vendor accuracy claim must not read as a ParkWiz number');
  // Enforcement revenue is the recurring temptation the repo keeps cutting.
  assert.match(brief, /לא אכיפה, לא קנסות/);
});

test('the briefing keeps personal details out of a public repo', () => {
  assert.match(brief, /לא נרשמים כאן שמות מלאים, טלפונים או כתובות אישיות/);
  assert.doesNotMatch(brief, /@[a-z0-9.-]+\.[a-z]{2,}/i, 'no personal email addresses');
  assert.doesNotMatch(brief, /0\d{1,2}-?\d{7}/, 'no phone numbers');
});

test('the briefing answers RTSP with the truth: there is no live pipeline', () => {
  assert.match(brief, /\*\*«אתם צריכים RTSP\?»\*\*/);
  assert.match(brief, /אין בריפו שום צינור מצלמה חי/);
  assert.match(brief, /לא RTSP, לא ONVIF/);
  assert.match(brief, /snapshot/);
});

test('the briefing prices the pilot at zero and names a stopping rule', () => {
  assert.match(brief, /0 ₪ לשני הצדדים/);
  assert.match(brief, /מצלמה אחת, שורה אחת/);
  assert.match(brief, /8 זיווגים/);
  assert.match(brief, /\*\*מתחת ל־90%\*\*/);
  assert.match(brief, /מחיר המשך לא נקבע|אין מחירון/);
});

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

test('the demo banner says the frames are synthetic and the lot is not a customer', () => {
  assert.match(demo, /הפריימים האלה מסונתזים בקוד/);
  assert.match(demo, /<b>לא<\/b> חניון פארק עתידים/);
  assert.match(demo, /<b>לא לקוחות<\/b>/);
  assert.match(demo, /דיוק מול ספירה ידנית בשטח עדיין לא נמדד/);
  assert.match(demo, /אין כאן זיהוי לוחיות/);
  // The KPI must not read as inspector agreement.
  assert.match(demo, /הסכמה מול התוויות \(לא פקח\)/);
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
  delete require.cache[require.resolve('../src/lib/dataset.js')];
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
  delete require.cache[require.resolve('../src/lib/dataset.js')];
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

// The briefing prints the exact counts the presenter should see on screen, so a
// number that drifts in the heuristic must not leave a stale table in the hands
// of someone standing in front of a customer.
test('the counts printed in the briefing match what the code actually produces', () => {
  delete require.cache[require.resolve('../src/lib/dataset.js')];
  const DS = require('../src/lib/dataset.js');
  const scenes = new Map(DS.scenes().map((s) => [s.id, s]));
  const expected = [
    ['יום — חניון חצי מלא', 'day-mixed'],
    ['שיא — חניון מלא', 'day-full'],
    ['דמדומים', 'dusk-mixed'],
    ['לילה', 'night-mixed'],
    ['אספלט רטוב', 'wet-mixed'],
    ['**מלכודת: צל על מקום ריק**', 'shadow-false'],
    ['**מלכודת: רכב בצבע אספלט**', 'camouflage-day'],
  ];
  for (const [label, id] of expected) {
    const report = DS.evaluateScene(scenes.get(id), 'v2');
    const sys = report.spots.filter((s) => s.predicted).length;
    const truth = report.spots.filter((s) => s.expected).length;
    const row = brief.split('\n').find((l) => l.startsWith('| ' + label + ' |'));
    assert.ok(row, `the briefing has no row for ${label}`);
    const cells = row.split('|').map((c) => c.trim());
    assert.equal(cells[2].replace(/\*/g, ''), `${sys} / ${report.n}`, `${id}: system count`);
    assert.equal(cells[3].replace(/\*/g, ''), `${truth} / ${report.n}`, `${id}: label count`);
    assert.equal(cells[4].replace(/\*/g, ''), `${report.agree} / ${report.n}`, `${id}: agreement`);
  }
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

test('README points a reader at both new artefacts', () => {
  const readme = read('README.md');
  assert.match(readme, /demo\/atidim\.html/);
  assert.match(readme, /ATIDIM-MEETING\.md/);
});
