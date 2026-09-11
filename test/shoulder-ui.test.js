// The map page is one big inline script, so this file runs that script in a
// stubbed DOM and asks it the same questions the UI asks it. Regex over the
// HTML can only prove a string is present; this proves the number a person sees
// beside a shoulder came out of the shoulder rule and not the bay rule.
process.env.TZ = 'Asia/Jerusalem'; // the availability model reasons in Israel time

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SH = require('../src/lib/shoulder');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

// The harness lives in test/helpers/parkwiz-page.js: it runs the page's inline
// script with a DOM stub that remembers what each render wrote, and a Leaflet
// stub that records every tooltip, so a test can read the strings a person sees.
const { loadPage, written, FIXED_NOW } = require('./helpers/parkwiz-page');

const REF = new Date('2026-07-14T07:00:00+03:00'); // Tuesday, before the 08:00 slot

test('the demo map carries shoulder streets, each with a shoulder length', () => {
  const { page } = loadPage();
  const shoulders = page.STREETS_DEF.filter((s) => s.type === SH.SURFACE);
  assert.ok(shoulders.length >= 2, 'expected at least two shoulder streets on the map');
  for (const s of shoulders) {
    assert.equal(typeof s.shoulderM, 'number', `${s.name} needs a shoulder length`);
    assert.ok(s.shoulderM > 0, `${s.name} needs a positive shoulder length`);
  }
});

test('a marked bay still shows the bay signal, untouched', () => {
  const { page } = loadPage();
  page.STREETS_DEF.forEach((s, i) => {
    if (s.type === SH.SURFACE) return;
    const signal = Array.from(page.getStreetHourlySignalSeries(i, REF));
    assert.deepEqual(Array.from(page.getStreetHourlyModelSeries(i, REF)), signal, `${s.name} was adjusted`);
  });
});

test('a shoulder shows the shoulder rule, and the two rules disagree', () => {
  const { page } = loadPage();
  const idx = page.STREETS_DEF.findIndex((s) => s.type === SH.SURFACE);
  const s = page.STREETS_DEF[idx];
  const signal = Array.from(page.getStreetHourlySignalSeries(idx, REF));
  const shown = Array.from(page.getStreetHourlyModelSeries(idx, REF));
  const byRule = signal.map((pct) => SH.shoulderAvailabilityPct({
    shoulderLengthM: s.shoulderM, streetAvailPct: pct, vehicleLenM: 4.5,
  }));
  assert.deepEqual(shown, byRule, 'the displayed series is not the shoulder rule');
  assert.notDeepEqual(shown, signal, 'a shoulder answered exactly like a bay');
});

// Hand-derived, and pinned so a silent change of rule or of demo data is visible.
// בן גוריון: baseline 25, shoulder 18 m. The availability model takes the street to
// 13 at 08:00 (weekday morning -12) and to 5 at 18:00 and 20:00 (weekday evening -20).
//   13 -> streetOcc .87 -> shoulderOcc .675 -> run 5.85 m -> sedan ratio 1.194 -> 27
//   25 -> streetOcc .75 -> shoulderOcc .375 -> run 11.25 m -> ratio 2.296 -> 69
//    5 -> streetOcc .95 -> shoulderOcc .875 -> run 2.25 m -> ratio 0.459 -> 0
test('the pinned shoulder day for בן גוריון', () => {
  const { page } = loadPage();
  const idx = page.STREETS_DEF.findIndex((s) => s.name === 'בן גוריון');
  assert.equal(page.STREETS_DEF[idx].type, SH.SURFACE);
  assert.equal(page.STREETS_DEF[idx].shoulderM, 18);
  assert.deepEqual(Array.from(page.getStreetHourlySignalSeries(idx, REF)), [13, 25, 25, 25, 25, 5, 5]);
  assert.deepEqual(Array.from(page.getStreetHourlyModelSeries(idx, REF)), [27, 69, 69, 69, 69, 0, 0]);
});

// דן שומרון: baseline 66, shoulder 14 m. The street never gets busy enough for the
// spill to reach the shoulder, so the shoulder stays flat while the bay number moves —
// which is "last to fill" showing up on the hourly chart.
test('the pinned shoulder day for דן שומרון', () => {
  const { page } = loadPage();
  const idx = page.STREETS_DEF.findIndex((s) => s.name === 'דן שומרון');
  assert.equal(page.STREETS_DEF[idx].shoulderM, 14);
  assert.deepEqual(Array.from(page.getStreetHourlySignalSeries(idx, REF)), [54, 66, 66, 66, 66, 46, 46]);
  assert.deepEqual(Array.from(page.getStreetHourlyModelSeries(idx, REF)), [90, 90, 90, 90, 90, 90, 90]);
});

test('the shoulder answer moves with the driver vehicle; the bay answer cannot', () => {
  const { page, store } = loadPage();
  const shoulderIdx = page.STREETS_DEF.findIndex((s) => s.name === 'בן גוריון');
  const bayIdx = page.STREETS_DEF.findIndex((s) => s.type === 'blue');
  const read = (idx) => page.getStreetHourlyModelSeries(idx, REF)[1]; // the 10:00 slot
  const seen = {};
  for (const vehicle of ['small', 'sedan', 'suv', 'van']) {
    store.pw_vehicle = vehicle;
    seen[vehicle] = { shoulder: read(shoulderIdx), bay: read(bayIdx) };
  }
  // 11.25 m of free run, needs 4.2 / 4.9 / 5.3 / 5.9 m
  assert.deepEqual([seen.small.shoulder, seen.sedan.shoulder, seen.suv.shoulder, seen.van.shoulder],
    [83, 69, 62, 54]);
  assert.equal(seen.small.bay, seen.van.bay, 'the bay rule cannot see the vehicle at all');
});

test('the list row and the street card both carry the shoulder note', () => {
  const { page } = loadPage();
  const idx = page.STREETS_DEF.findIndex((s) => s.type === SH.SURFACE);
  const note = page.shoulderNoteHtml(idx, 25);
  assert.ok(note.includes(page.SHOULDER_COPY.notice), 'the note must carry the notice');
  assert.ok(note.includes(page.SHOULDER_COPY.why), 'the note must say why a shoulder differs');
  assert.ok(note.includes(page.SHOULDER_COPY.listTag));
  // 11.25 m of run holds two sedans; the copy says so as an estimate, not a count.
  assert.ok(note.includes(page.SHOULDER_COPY.roomMany.replace('{n}', 2)), note);
  // and both surfaces that show a shoulder chance render it
  assert.match(html, /\$\{isShoulderStreet\(s\.idx\) \? shoulderNoteHtml\(s\.idx, getStreetSignalPct\(s\.idx\)\) : ''\}/);
  assert.match(html, /scShoulder\.innerHTML = shoulderNoteHtml\(idx, getStreetSignalPct\(idx\)\);/);
});

test('map, legend and filter bar tell a shoulder apart from a marked bay', () => {
  const { page } = loadPage();
  assert.equal(page.shoulderMapTag(SH.SURFACE), ' · ' + page.SHOULDER_COPY.mapTag);
  assert.equal(page.shoulderMapTag('blue'), '');
  const colours = Object.entries(page.CURB_TYPES).map(([k, v]) => [k, v.c]);
  const shoulderColour = page.CURB_TYPES[SH.SURFACE].c;
  assert.ok(shoulderColour, 'the shoulder needs a curb colour of its own');
  for (const [k, c] of colours) {
    if (k !== SH.SURFACE) assert.notEqual(c, shoulderColour, `${k} shares the shoulder colour`);
  }
  assert.equal(page.activeFilters[SH.SURFACE], true);
  assert.match(html, /id="filt-shoulder"[^>]*aria-pressed="true"/);
  assert.match(html, new RegExp(`background:${shoulderColour}`), 'the legend needs the shoulder swatch');
  // a shoulder street's curb stays a shoulder; it never turns into a marked bay
  const idx = page.STREETS_DEF.findIndex((s) => s.type === SH.SURFACE);
  const kinds = new Set(page.CURBS[idx].map((c) => c.type));
  for (const kind of kinds) assert.ok([SH.SURFACE, 'red'].includes(kind), `curb turned into ${kind}`);
  assert.ok(kinds.has(SH.SURFACE));
});

test('labels and tariff for a shoulder come from the shoulder copy', () => {
  const { page } = loadPage();
  assert.equal(page.parkingTypeLabel(SH.SURFACE), page.SHOULDER_COPY.typeLabel);
  assert.equal(page.parkingTariffLabel(SH.SURFACE), page.SHOULDER_COPY.tariff);
  assert.notEqual(page.parkingTypeLabel('blue'), page.SHOULDER_COPY.typeLabel);
  assert.notEqual(page.parkingTariffLabel('free'), page.SHOULDER_COPY.tariff);
});

test('the offline shell ships the shoulder module', () => {
  const assetsBlock = sw.slice(sw.indexOf('const ASSETS'), sw.indexOf('];') + 2);
  assert.match(assetsBlock, /src\/lib\/shoulder\.js/);
  assert.match(html, /<script src="src\/lib\/shoulder\.js"><\/script>/);
});

// ─── התאמת אורך, לא סיכוי ────────────────────────────────────────────────────
// The number beside a shoulder is a LENGTH-FIT score: free run against the
// length of your car. Calling it "סיכוי למצוא חניה" (chance of finding parking)
// is the right number under the wrong name, and the map tooltip carried no
// reframing at all. Every surface below is RENDERED here, not grepped.
const FIT_WORDS = {
  badge: 'התאמת אורך לרכב שלך',
  short: 'התאמת אורך',
  manyCars: 'מקום משוער לכמה רכבים בגודל שלך',
  oneCar: 'מקום משוער לרכב אחד בגודל שלך',
  tooShort: 'הקטע הפנוי קצר מהרכב שלך',
};
const FIT_KEYS = ['fitBadge', 'fitShort', 'fitLevelHigh', 'fitLevelMid', 'fitLevelLow',
  'fitLevelUnknown', 'fitHeadlineHigh', 'fitHeadlineMid', 'fitHeadlineLow'];

function rowFor(listHtml, name) {
  const row = listHtml.split('class="spot-item').find((r) => r.includes(name));
  assert.ok(row, `no list row for ${name}`);
  return row;
}

test('the shoulder copy names the number a length fit, word for word', () => {
  const { page } = loadPage();
  assert.equal(page.SHOULDER_COPY.fitBadge, FIT_WORDS.badge);
  assert.equal(page.SHOULDER_COPY.fitShort, FIT_WORDS.short);
  assert.equal(page.SHOULDER_COPY.fitLevelHigh, FIT_WORDS.manyCars);
  assert.equal(page.SHOULDER_COPY.fitLevelMid, FIT_WORDS.oneCar);
  assert.equal(page.SHOULDER_COPY.fitLevelLow, FIT_WORDS.tooShort);
  for (const key of FIT_KEYS) {
    assert.ok(page.SHOULDER_COPY[key], `SHOULDER_COPY.${key} is missing`);
    assert.ok(!page.SHOULDER_COPY[key].includes('סיכוי'),
      `SHOULDER_COPY.${key} calls a length-fit score a chance`);
  }
});

test('every surface that shows a shoulder number renders it as a length fit', () => {
  const { page, els, tooltips } = loadPage({ now: FIXED_NOW });
  const idx = page.STREETS_DEF.findIndex((s) => s.name === 'בן גוריון');
  const bayIdx = page.STREETS_DEF.findIndex((s) => s.name === 'הרצל');
  // hand-derived: signal 25 -> street occupancy .75 -> spill .375 -> free run
  // 11.25 m; a sedan needs 4.5+0.4 m -> ratio 2.2959 -> 69%, and 2 cars fit.
  assert.equal(page.getStreetSignalPct(idx), 25);
  assert.equal(page.getCurrentHourAvailabilityPct(idx), 69);

  // the map circle
  page.initRealMap();
  const tip = tooltips.find((t) => t.startsWith('בן גוריון') && t.includes('%'));
  assert.equal(tip, 'בן גוריון · שוליים · התאמת אורך 69% (הערכה, לא הבטחה)');
  const bayTip = tooltips.find((t) => t.startsWith('הרצל') && t.includes('%'));
  assert.match(bayTip, /^הרצל · סיכוי \d+% \(הערכה, לא הבטחה\)$/);

  // the list row
  page.renderSidePanel();
  const row = rowFor(written(els, 'spotsList'), 'בן גוריון');
  assert.ok(row.includes(`<span>${FIT_WORDS.badge}</span><strong>69%</strong>`), row);
  assert.ok(row.includes(FIT_WORDS.manyCars), row);
  assert.ok(!row.includes('סיכוי'), 'the rendered shoulder row still says סיכוי');
  assert.ok(rowFor(written(els, 'spotsList'), 'הרצל').includes('סיכוי למצוא חניה'),
    'a marked bay must keep the chance wording');

  // the street card
  page.renderStreetCard(idx, false);
  assert.equal(written(els, 'scChanceBadge'), `<span>${FIT_WORDS.badge}</span><strong>69%</strong>`);
  assert.ok(written(els, 'scLabel').includes(FIT_WORDS.manyCars), written(els, 'scLabel'));
  assert.ok(written(els, 'scLabel').includes(FIT_WORDS.badge), written(els, 'scLabel'));
  const card = written(els, 'scCommunity');
  assert.ok(card.startsWith('🎯 התאמת אורך 69% — לפי ההערכה הקטע הפנוי מכיל כמה רכבים בגודל שלך'),
    card.slice(0, 160));
  assert.ok(!card.includes('סיכוי'), card.slice(0, 200));

  // and the marked bay keeps the probability language it always had
  page.renderStreetCard(bayIdx, false);
  assert.ok(written(els, 'scChanceBadge').includes('סיכוי למצוא חניה'));
  assert.ok(written(els, 'scCommunity').includes('סיכוי'));
});

test('an empty shoulder shorter than the car is not called crowded', () => {
  const at8 = new Date('2026-07-14T08:00:00+03:00').getTime();
  const { page, els, store } = loadPage({ now: at8 });
  store.pw_vehicle = 'van'; // 5.5 m + 0.4 m manoeuvre = 5.9 m needed
  const idx = page.STREETS_DEF.findIndex((s) => s.name === 'בן גוריון');
  // signal 13 -> occupancy .87 -> spill .675 -> free run 5.85 m. Nobody has to
  // be standing there: the run is simply shorter than the van, so 0%.
  assert.equal(page.getStreetSignalPct(idx), 13);
  assert.equal(page.getCurrentHourAvailabilityPct(idx), 0);
  page.renderSidePanel();
  const row = rowFor(written(els, 'spotsList'), 'בן גוריון');
  assert.ok(row.includes(FIT_WORDS.tooShort), row);
  assert.ok(!row.includes('עמוס'), 'bay vocabulary (crowded) on a length-fit score of 0%');
});

// ─── שתי שורות על אותם שוליים, אותו רגע ──────────────────────────────────────
// The shoulder note said "room for about 2 cars" and the vehicle-fit line one
// line below said "✗ too narrow for your car (estimated gap 4.7 m)" about the
// same shoulder at the same moment: the fit line was still running the marked
// bay's gap model, which invents a gap from the street index. On a shoulder it
// now reads the same free run the percentage and the car count come from.
const RUN_WORDS = {
  many: '✓ הקטע הפנוי המשוער מכיל את הרכב שלך בנוח',
  one: '⚠ הקטע הפנוי המשוער מכיל את הרכב שלך בצמצום',
  short: '✗ הקטע הפנוי המשוער קצר מהרכב שלך',
};

test('the shoulder note and the vehicle-fit line describe the same free run', () => {
  const { page, els } = loadPage({ now: FIXED_NOW });
  const idx = page.STREETS_DEF.findIndex((s) => s.name === 'בן גוריון');
  // signal 25 -> free run 11.25 m, shown floored to 11.2; a sedan needs 4.9 m,
  // so two cars fit and the fit line must agree with the room line.
  assert.equal(page.getStreetSignalPct(idx), 25);
  assert.equal(page.shoulderFreeRunM(idx, 25), 11.2);
  assert.equal(page.shoulderCarsFree(idx, 25), 2);

  page.renderSidePanel();
  const row = rowFor(written(els, 'spotsList'), 'בן גוריון');
  assert.ok(row.includes('לפי ההערכה יש מקום לכ- 2 רכבים בגודל שלך לאורך הקטע הפנוי'), row);
  assert.ok(row.includes(RUN_WORDS.many), row);
  assert.ok(row.includes('(קטע פנוי משוער 11.2 מטר · הרכב שלך צריך 4.9 מטר)'), row);
  assert.ok(!row.includes('צר מדי'), 'the bay gap verdict is still shown on a shoulder');
  assert.ok(!row.includes('מרווח משוער'), 'the bay gap model is still describing a shoulder');

  // a marked bay keeps the gap model it always had
  const bayRow = rowFor(written(els, 'spotsList'), 'הרצל');
  assert.ok(bayRow.includes('מרווח משוער'), bayRow);
});

test('the room line and the fit line cannot disagree, for any car at any hour', () => {
  const hours = ['2026-07-14T08:00:00+03:00', '2026-07-14T10:00:00+03:00', '2026-07-14T18:00:00+03:00'];
  for (const vehicle of ['small', 'sedan', 'suv', 'van']) {
    for (const iso of hours) {
      const { page, store } = loadPage({ now: new Date(iso).getTime() });
      store.pw_vehicle = vehicle;
      page.STREETS_DEF.forEach((s, idx) => {
        if (!page.isShoulderStreet(idx)) return;
        const signal = page.getStreetSignalPct(idx);
        const room = page.shoulderRoomLine(idx, signal);
        const fit = page.fitInfo(idx);
        const noRoom = room === page.SHOULDER_COPY.roomNone;
        assert.equal(noRoom, fit.txt === RUN_WORDS.short,
          `${s.name} ${vehicle} ${iso}: room="${room}" fit="${fit.txt}"`);
        assert.equal(room === page.SHOULDER_COPY.roomOne, fit.txt === RUN_WORDS.one,
          `${s.name} ${vehicle} ${iso}: room="${room}" fit="${fit.txt}"`);
        assert.equal(fit.gap, page.shoulderFreeRunM(idx, signal));
      });
    }
  }
});

// ─── פאנל ההגעה ──────────────────────────────────────────────────────────────
// The arrival panel suggested בן גוריון and printed "25% פנוי" next to it — the
// static bay baseline — while the map circle, the list row and the street card
// all said 69% at that same moment, and while the whole point of the shoulder
// rule is that a shoulder is not measured in "percent free of a bay row".
test('the arrival panel shows the same number as every other surface', () => {
  const { page, els } = loadPage({ now: FIXED_NOW });
  const idx = page.STREETS_DEF.findIndex((s) => s.name === 'בן גוריון');
  const s = page.STREETS_DEF[idx];
  assert.equal(s.avail, 25, 'the static baseline this panel used to print');
  assert.equal(page.getCurrentHourAvailabilityPct(idx), 69, 'what every other surface shows');

  page.initRealMap();
  page.arrivalMode(s.lat, s.lng, 'יעד בדיקה');
  const panel = written(els, 'arrivalPanel');
  assert.ok(panel.includes('בן גוריון'), panel);
  assert.ok(panel.includes('התאמת אורך 69%'), panel);
  assert.ok(!panel.includes('25% פנוי'), 'the arrival panel still prints the static baseline');
  assert.ok(!panel.includes('69% פנוי'), 'a shoulder is not a percent of free bays');
  assert.equal(page.arrivalAvailLabel(idx), 'התאמת אורך 69%');

  // a marked bay keeps its own wording, with the live number
  const bay = page.STREETS_DEF.findIndex((x) => x.type === 'blue');
  assert.equal(page.arrivalAvailLabel(bay), page.getCurrentHourAvailabilityPct(bay) + '% פנוי');
});

test('the recommended-streets card ranks and shows the live number too', () => {
  const { page, els } = loadPage({ now: FIXED_NOW });
  const idx = page.STREETS_DEF.findIndex((s) => s.name === 'בן גוריון');
  page.showRecommended(null);
  const reco = written(els, 'recoList');
  assert.ok(reco.length > 0, 'the recommended card rendered nothing');
  if (reco.includes('בן גוריון')) {
    assert.ok(reco.includes('(' + page.getCurrentHourAvailabilityPct(idx) + '%)'), reco);
    assert.ok(!reco.includes('(25%)'), 'the recommended card still prints the static baseline');
  }
  // every street it names carries the number that street shows everywhere else
  page.STREETS_DEF.forEach((s, i) => {
    if (!reco.includes(s.name)) return;
    assert.ok(reco.includes('(' + page.getCurrentHourAvailabilityPct(i) + '%)'),
      `${s.name}: ${reco}`);
  });
});
