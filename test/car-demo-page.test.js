// demo/car-demo.html is the surface the #267 acceptance criterion names: on the
// live site, a simulated EV has to receive a freed spot within ~2s. These tests
// guard what would make that demo fail or mislead in front of an owner — a
// missing panel, a dead entry point, a simulated uplink that blows the 2s
// budget, a call into src/lib/car-api.js that no longer exists, a page that
// needs the network, or a claim the privacy doc does not back.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const carApi = require('../src/lib/car-api');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'demo', 'car-demo.html'), 'utf8');
const inlineScripts = [...html.matchAll(/<script(?![^>]*src=)>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);

test('the car demo is a Hebrew RTL page that opens with no network', () => {
  assert.match(html, /lang="he"/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.doesNotMatch(html, /https?:\/\/(unpkg|cdnjs|cdn|fonts\.googleapis|ajax\.googleapis)/i);
  assert.doesNotMatch(html, /fetch\(|XMLHttpRequest/);
  assert.match(html, /<link rel="icon" href="\.\.\/icon\.svg">/);
  assert.match(html, /navigator\.serviceWorker\.register\('\.\.\/sw\.js'\)/);
});

test('the page says plainly that there is no car, no plan and no charger', () => {
  assert.match(html, /אין כאן רכב אמיתי/);
  assert.match(html, /בדפדפן הזה בלבד/);
  assert.match(html, /מצב סימולציה/);
  assert.match(html, /קריאה בלבד/);
  // Read-only must be stated as a capability, not a policy: ParkWiz cannot
  // control a charger at all.
  assert.match(html, /לא יכול להתחיל, לעצור או לשחרר טעינה/);
});

test('all five parts of the issue have a panel on the page', () => {
  assert.match(html, /id="leavingBtns"/);              // 5. car-to-car: a leaving car publishes
  assert.match(html, /id="evCar"/);                    // 2. the Smartcar-fed EV subscriber
  assert.match(html, /id="batterySlider"/);
  assert.match(html, /id="ocppRows"/);                 // 3. OCPP read-only adapter + simulator
  assert.match(html, /id="eventLog"/);                 // 1. the JSON contract, visible
  assert.match(html, /spot-freed/);
  assert.match(html, /spot-claim/);
  assert.match(html, /spot-release/);
  assert.match(html, /docs\/car-api-he\.md|\.\.\/docs\/car-api-he\.md/);
  assert.match(html, /\.\.\/docs\/car-android-auto\.md/);  // 4. Android Auto design doc
});

test('the simulated uplink fits inside the ~2s acceptance budget', () => {
  const delay = Number(html.match(/const RADIO_DELAY_MS = (\d+);/)[1]);
  const target = Number(html.match(/const LATENCY_TARGET_MS = (\d+);/)[1]);
  assert.equal(target, 2000, 'the issue asks for delivery within ~2s');
  assert.ok(delay > 0, 'an instant hand-off would not model a telematics uplink');
  // Leave room for the measured round trip, not just the delay itself.
  assert.ok(delay <= target / 2, 'simulated uplink ' + delay + 'ms is too close to the 2s budget');
  // The page reports the measured number and compares it to the target rather
  // than printing a fixed "2 seconds" claim.
  assert.match(html, /el\('kpiLatency'\)\.textContent = elapsed \+ ' ms'/);
  assert.match(html, /elapsed <= LATENCY_TARGET_MS/);
  assert.match(html, /id="radioDelayLbl"/);
});

test('the EV only hears events while it is subscribed, and only spot-freed', () => {
  assert.match(html, /types: \['spot-freed'\]/);
  assert.match(html, /radiusM: car\.DEFAULT_RADIUS_M/);
  assert.match(html, /carId: EV_CAR_ID/);
  // A leaving car must not be the EV itself, or the relay's no-echo rule would
  // make the demo look broken.
  assert.match(html, /carId: 'car-leaving-sim'/);
  assert.match(html, /הרכב לא מנוי/);
});

test('the battery drives the recommendation through the shared ranker', () => {
  assert.match(html, /car\.rankSpots\(/);
  assert.match(html, /car\.fromSmartcar\(smartcarPayload\(batteryPct\(\)\)\)/);
  assert.match(html, /percentRemaining: pct \/ 100/);
  assert.match(html, /reasonKey === 'charger-low-battery'/);
  assert.match(html, /car\.LOW_BATTERY_PCT/);
  // The threshold and the bay geography must actually produce the charger
  // preference the page claims, with the page's own spots and default battery.
  const spots = [...html.matchAll(/\{ id: '([^']+)', kind: '(street|charger)', lat: ([\d.]+), lon: ([\d.]+)/g)]
    .map((m) => ({ id: m[1], kind: m[2], lat: Number(m[3]), lon: Number(m[4]) }));
  assert.ok(spots.length >= 3, 'the demo needs street bays and charger bays');
  const at = {
    lat: Number(html.match(/location: \{ latitude: ([\d.]+), longitude: ([\d.]+) \}/)[1]),
    lon: Number(html.match(/location: \{ latitude: ([\d.]+), longitude: ([\d.]+) \}/)[2]),
  };
  const startBattery = Number(html.match(/id="batterySlider"[\s\S]*?value="(\d+)"/)[1]);
  assert.ok(startBattery <= carApi.LOW_BATTERY_PCT, 'the demo opens on a low battery');
  const low = carApi.rankSpots({ car: { at, batteryPct: startBattery }, spots });
  assert.equal(low.best.spot.kind, 'charger');
  const full = carApi.rankSpots({ car: { at, batteryPct: 100 }, spots });
  assert.equal(full.best.spot.kind, 'street');
});

test('the privacy panel and the plate probe back the no-plates promise', () => {
  assert.match(html, /לא יזוהו לוחיות רישוי/);
  assert.match(html, /source\.consent/);
  assert.match(html, /opt-in/);
  assert.match(html, /id="btnPlateProbe"/);
  assert.match(html, /droppedFields/);
  assert.match(html, /SMARTCAR_CLIENT_ID/);
  // The probe must show the guard firing, not just assert it in prose.
  assert.match(html, /check\.event\.droppedFields\.join/);
});

test('the live regions and controls are reachable by keyboard and screen reader', () => {
  assert.match(html, /id="evStatus" role="status" aria-live="polite"/);
  assert.match(html, /id="leavingStatus" role="status" aria-live="polite"/);
  assert.match(html, /id="ocppStatus" role="status" aria-live="polite"/);
  assert.match(html, /<section class="kpis" aria-label="מדדי הממסר" aria-live="polite">/);
  assert.match(html, /id="btnSubscribe" aria-pressed="false"/);
  assert.match(html, /setAttribute\('aria-pressed', on \? 'true' : 'false'\)/);
  assert.match(html, /<th scope="col">/);
  assert.match(html, /class="skip-link"/);
  // Claim and release are meaningless before an offer arrives, so they start
  // disabled rather than publishing an event about nothing.
  assert.match(html, /id="btnClaim" disabled/);
  assert.match(html, /id="btnRelease" disabled/);
  assert.match(html, /id="eventLogEmpty">אין עדיין אירועים ביומן/);
});

test('every car-api call on the page exists in src/lib/car-api.js', () => {
  const exported = new Set(Object.keys(carApi));
  const used = new Set();
  for (const code of inlineScripts) {
    for (const m of code.matchAll(/\bcar\.([A-Za-z_$][\w$]*)/g)) used.add(m[1]);
  }
  assert.ok(used.size > 5, 'the page must drive the shared contract library');
  assert.deepEqual([...used].filter((name) => !exported.has(name)), []);
  // It must be the shared library, not a copy of the contract pasted inline.
  assert.match(html, /<script src="\.\.\/src\/lib\/car-api\.js"><\/script>/);
  assert.match(html, /window\.ParkWizCarApi/);
  assert.match(html, /ספריית החוזה \(car-api\.js\) לא נטענה/);
});

test('the car demo is reachable from the homepage and in the offline shell', () => {
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(index, /href="\.\/demo\/car-demo\.html"/);
  assert.match(index, /דמו רכב מחובר/);
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(sw, /'\.\/demo\/car-demo\.html'/);
  assert.match(sw, /'\.\/src\/lib\/car-api\.js'/);
  assert.ok(Number(sw.match(/parkwiz-field-v(\d+)/)[1]) >= 19, 'a new shell page needs a cache bump');
});

test('the car demo inline JavaScript compiles with zero syntax errors', () => {
  assert.ok(inlineScripts.length > 0);
  for (const code of inlineScripts) {
    assert.doesNotThrow(() => new vm.Script(code), 'inline script must parse cleanly');
  }
});
