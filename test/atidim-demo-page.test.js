// demo/atidim.html is the operator-facing page shown live in a Park Atidim /
// CityZone meeting, so these tests guard what makes it unusable in that room:
// a missing section, a dead entry point, an inline script that does not parse,
// a call into src/lib/atidim-lot.js that no longer exists, a clock in the wrong
// time zone, or a caption that claims a peak window the bars contradict.
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
  // No runtime network calls at all: the page must open in airplane mode.
  assert.doesNotMatch(html, /fetch\(|XMLHttpRequest/);
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
  assert.match(html, /id="btnReset"/);                      // back to the modelled hour
});

test('the page states plainly that the frame is a simulation', () => {
  assert.match(html, /הדמיה ממוחשבת/);
  assert.match(html, /אין כאן שידור חי/);
  assert.match(html, /SIM/);
});

test('the page never misreports its own state to the operator', () => {
  // The overlay starts drawn, so its button must offer to hide it, not to show it.
  assert.match(html, /id="btnToggleOverlay"[^>]*aria-pressed="true"[^>]*>הסתר שכבת זיהוי תאים</);
  assert.match(html, /showOverlay \? 'הסתר שכבת זיהוי תאים' : 'הצג שכבת זיהוי תאים'/);
  // A UTC stamp renders the frame two hours behind in Israel, which reads as a
  // stalled stream; a baked-in 16 made the chart claim 16:00 at any meeting hour.
  // Both now come from the model, which formats the lot's own wall clock.
  assert.doesNotMatch(html, /toISOString/);
  assert.doesNotMatch(html, /getHours\(\)/);
  assert.match(html, /model\.formatLotClock\(new Date\(\)\)/);
  assert.match(html, /const nowHour = model\.lotHour\(\)/);
  assert.match(html, /pt\.hour === nowHour/);
  assert.doesNotMatch(html, /pt\.hour === \d+/);
  // Free-count KPI is reported as free / monitored, not occupied / monitored.
  assert.match(html, /occ\.availableInView \+ ' \/ ' \+ occ\.totalInView/);
});

test('the frame is seeded per camera from the model and cannot blank out', () => {
  assert.match(html, /model\.createCameraSpots\(currentCam, seededHour\)/);
  assert.match(html, /model\.cameraView\(currentCam\)/);
  // roundRect is missing on Safari < 16 and Firefox < 112; without the fallback the
  // first parked car throws and the operator is left looking at a blank canvas.
  assert.match(html, /typeof ctx\.roundRect === 'function'/);
  assert.match(html, /quadraticCurveTo/);
  assert.doesNotMatch(html, /ctx\.beginPath\(\); ctx\.roundRect/);
});

test('the live counters and the canvas are exposed to assistive tech', () => {
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<canvas id="lotCanvas"[^>]*tabindex="0"/);
  assert.match(html, /canvas\.addEventListener\('keydown'/);
  assert.match(html, /id="bayStatus"[^>]*role="status"/);
  assert.match(html, /class="cam-sel active"[^>]*data-cam="cam-01"[^>]*aria-pressed="true"[^>]*aria-label="מצלמה 01/);
  assert.match(html, /class="cam-sel"[^>]*data-cam="cam-02"[^>]*aria-pressed="false"[^>]*aria-label="מצלמה 02/);
  assert.match(html, /class="cam-sel"[^>]*data-cam="cam-03"[^>]*aria-pressed="false"[^>]*aria-label="מצלמה 03/);
  assert.match(html, /id="btnCopySummary">העתק תקציר מצב<\/button>/);
  assert.match(html, /כל התאים בפריים כבר תפוסים/);
  assert.match(html, /כל התאים בפריים כבר פנויים/);
  assert.match(html, /תקציר מצב החניון הועתק ללוח/);
  assert.match(html, /מודל החניון לא נטען — נא לרענן את הדף/);
});

test('the peak caption is derived from the model, not typed into the markup', () => {
  const peaks = lotModel.getHourlyCurve().filter((pt) => pt.isPeak);
  assert.ok(peaks.length > 0, 'the hourly curve must have a peak window');
  // No hard-coded window: editing HOURLY_RATES must never leave the caption
  // quoting hours the bars no longer show.
  assert.doesNotMatch(html, /שעות שיא: \d{2}:\d{2}/);
  assert.match(html, /peaks\[0\]\.label \+ ' - ' \+ peaks\[peaks\.length - 1\]\.label/);
  assert.match(html, /model\.PEAK_THRESHOLD/);
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
  // changing the page without bumping CACHE leaves returning visitors on the old shell.
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(sw, /'\.\/demo\/atidim\.html'/);
  assert.match(sw, /'\.\/src\/lib\/atidim-lot\.js'/);
  assert.ok(Number(sw.match(/parkwiz-field-v(\d+)/)[1]) >= 11);
});

test('demo/atidim.html inline JavaScript compiles with zero syntax errors', () => {
  assert.ok(inlineScripts.length > 0, 'must test at least one inline script block');
  for (const code of inlineScripts) {
    assert.doesNotThrow(() => new vm.Script(code), 'inline script must parse cleanly');
  }
});
