// demo/atidim.html is the operator-facing page shown live in a Park Atidim /
// CityZone meeting, so these tests guard what makes it unusable in that room:
// a missing section, a dead entry point, an inline script that does not parse,
// a call into src/lib/atidim-lot.js that no longer exists, or a caption that
// claims a peak window the bars contradict.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const lotModel = require('../src/lib/atidim-lot');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'demo', 'atidim.html'), 'utf8');
// Every inline (src-less) <script> block on the page.
const inlineScripts = [...html.matchAll(/<script(?![^>]*src=)>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);

test('demo/atidim.html is a Hebrew RTL page that works with no network', () => {
  assert.match(html, /lang="he"/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.doesNotMatch(html, /https?:\/\/(unpkg|cdnjs|cdn|fonts\.googleapis|ajax\.googleapis)/i);
});

test('demo/atidim.html includes all required operator components', () => {
  assert.match(html, /<canvas id="lotCanvas"/);             // camera stream + overlay
  assert.match(html, /שכבת זיהוי תאים/);
  assert.match(html, /id="kpiAvailable"/);                  // live count
  assert.match(html, /מקומות פנויים כעת/);
  assert.match(html, /id="hourlyChart"/);                   // hourly occupancy chart
  assert.match(html, /התפלגות תפוסה יומית/);
  assert.match(html, /איך זה עובד עם המצלמות הקיימות שלכם/);  // works with existing cameras
  assert.match(html, /RTSP/);
  assert.match(html, /פרטיות מובטחת/);                       // privacy guarantee
  assert.match(html, /ללא זיהוי לוחיות רישוי/);
  assert.match(html, /פיילוט ללא עלות/);                     // contact / CTA
  assert.match(html, /offer\.html/);
  assert.match(html, /<link rel="icon" href="\.\.\/icon\.svg">/);
  assert.match(html, /navigator\.serviceWorker\.register\('\.\.\/sw\.js'/);
  assert.match(html, /canvas\.addEventListener\('click'/);  // manual stall correction
});

test('the page never misreports its own state to the operator', () => {
  // The overlay starts drawn, so its button must offer to hide it, not to show it.
  assert.match(html, /id="btnToggleOverlay"[^>]*aria-pressed="true"[^>]*>הסתר שכבת זיהוי תאים</);
  assert.match(html, /showOverlay \? 'הסתר שכבת זיהוי תאים' : 'הצג שכבת זיהוי תאים'/);
  // A UTC stamp renders the frame two hours behind in Israel, which reads as a
  // stalled stream; a baked-in 16 made the chart claim 16:00 at any meeting hour.
  assert.doesNotMatch(html, /toISOString/);
  assert.match(html, /pad2\(d\.getHours\(\)\)/);
  assert.match(html, /const nowHour = new Date\(\)\.getHours\(\)/);
  assert.match(html, /pt\.hour === nowHour/);
  assert.doesNotMatch(html, /hour === 16/);
  // roundRect is missing on Safari < 16 and Firefox < 112; without the fallback the
  // first parked car throws and the operator is left looking at a blank canvas.
  assert.match(html, /typeof ctx\.roundRect === 'function'/);
  assert.match(html, /else ctx\.rect\(/);
});

test('the static peak caption agrees with the model it falls back for', () => {
  const peaks = lotModel.getHourlyCurve().filter((pt) => pt.isPeak);
  assert.ok(peaks.length > 0, 'the hourly curve must have a peak window');
  const mean = Math.round(peaks.reduce((sum, pt) => sum + pt.percentage, 0) / peaks.length);
  const caption = html.match(/id="chartPeak">([^<]*)</);
  assert.ok(caption, 'the chart needs a peak caption');
  assert.equal(caption[1], 'שעות שיא: ' + peaks[0].label + ' - '
    + peaks[peaks.length - 1].label + ' (תפוסה ממוצעת ' + mean + '%)');
});

test('every lot-model call on the page exists in src/lib/atidim-lot.js', () => {
  const exported = new Set(Object.keys(lotModel));
  const used = new Set();
  for (const code of inlineScripts) {
    for (const m of code.matchAll(/\bmodel\.([A-Za-z_$][\w$]*)/g)) used.add(m[1]);
  }
  assert.ok(used.size > 0, 'the page must drive the shared lot model');
  assert.deepEqual([...used].filter((name) => !exported.has(name)), []);
});

test('index.html and offer.html provide direct entry points to demo/atidim.html', () => {
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(indexHtml, /href="\.\/demo\/atidim\.html"/);
  assert.match(indexHtml, /פארק עתידים/);
  const offerHtml = fs.readFileSync(path.join(root, 'offer.html'), 'utf8');
  assert.match(offerHtml, /href="\.\/demo\/atidim\.html"/);
  assert.match(offerHtml, /דמו מפעיל חניון/);
});

test('the demo page and its model are in the offline shell', () => {
  // The meeting may run on lot Wi-Fi that drops, so the page has to be cached — and
  // adding assets without bumping CACHE leaves returning visitors on the old shell.
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(sw, /'\.\/demo\/atidim\.html'/);
  assert.match(sw, /'\.\/src\/lib\/atidim-lot\.js'/);
  assert.ok(Number(sw.match(/parkwiz-field-v(\d+)/)[1]) >= 10);
});

test('demo/atidim.html inline JavaScript compiles with zero syntax errors', () => {
  assert.ok(inlineScripts.length > 0, 'must test at least one inline script block');
  for (const code of inlineScripts) {
    assert.doesNotThrow(() => new vm.Script(code), 'inline script must parse cleanly');
  }
});
