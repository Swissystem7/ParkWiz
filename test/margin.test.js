// Waze-style arrival margins (#201): the board quotes a window of arrival times
// and a range of free bays, never one number that reads as a promise. These
// tests pin what makes the band honest — it widens with lookahead, and it never
// collapses to a single confident value.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const margin = require('../src/lib/margin');
const lot = require('../src/lib/atidim-lot');

const CURVE = margin.freeByHourFromSeries(lot.hourlySeries(lot.DEFAULT));
const at = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const window_ = (opts) => margin.arrivalMargin({ freeByHour: CURVE, total: lot.totalBays(lot.DEFAULT), ...opts });

test('the free-bay curve comes off the board lot and is read between the hours', () => {
  assert.equal(CURVE[10], lot.stateAt(10, lot.DEFAULT).free);
  assert.ok(CURVE[3] > CURVE[10], 'the lot is emptier at 03:00 than mid-morning');
  // A broken or partial series must not become a confident-looking curve.
  assert.equal(margin.freeByHourFromSeries(null), null);
  assert.equal(margin.freeByHourFromSeries(lot.hourlySeries(lot.DEFAULT).slice(0, 23)), null);
  assert.equal(margin.freeByHourFromSeries([{ hour: 0, total: 'x', occupied: 1 }]), null);
  // Interpolated, so a 10-minute window is not flat; wraps instead of running
  // off the end of the array.
  assert.equal(margin.freeAtMinute(CURVE, at('08:00')), CURVE[8]);
  assert.equal(margin.freeAtMinute(CURVE, at('08:30')), (CURVE[8] + CURVE[9]) / 2);
  assert.equal(margin.freeAtMinute(CURVE, at('23:30')), (CURVE[23] + CURVE[0]) / 2);
  assert.equal(margin.freeAtMinute([1, 2, 3], 0), null);
});

test('a zero-margin ask still answers with a window and a range, not a promise', () => {
  const m = window_({ nowMinutes: at('08:00'), etaMinutes: 0, bufferMinutes: 0 });
  assert.equal(m.windowLabel, '08:00–08:00');
  assert.equal(m.arrivalLabel, '08:00');
  assert.equal(m.slack, 0, 'arriving now needs no lookahead allowance');
  assert.deepEqual([m.low, m.high, m.expected], [CURVE[8], CURVE[8], CURVE[8]]);
  assert.equal(m.tone, 'חיזוי, לא הבטחה');
  assert.match(m.advice, /שולי ביטחון/, 'with no buffer the advice asks for one');
  const labels = [m.headline, m.rangeLabel, m.advice].join(' ');
  assert.doesNotMatch(labels, /מובטח|מבטיח|שמור לך/, 'no label may promise a spot: ' + labels);
});

test('the band widens with lookahead — one bay of doubt per quarter-hour', () => {
  const near = window_({ nowMinutes: at('08:00'), etaMinutes: 2, bufferMinutes: 0 });
  const far = window_({ nowMinutes: at('08:00'), etaMinutes: 30, bufferMinutes: 15 });
  assert.equal(near.slack, 1);
  assert.equal(far.slack, 3, 'ceil((30 + 15) / 15)');
  assert.ok(far.high - far.low > near.high - near.low, 'a later arrival is a wider claim');
  assert.equal(far.windowLabel, '08:15–08:45');
  // A window that crosses midnight keeps real clock labels.
  const night = window_({ nowMinutes: at('23:50'), etaMinutes: 10, bufferMinutes: 10 });
  assert.equal(night.windowLabel, '23:50–00:10');
  assert.deepEqual([night.arrivalLabel, night.toMinutes], ['00:00', at('00:10')]);
});

test('a filling lot is called out, so the driver leaves earlier instead of racing', () => {
  const filling = window_({ nowMinutes: at('08:00'), etaMinutes: 30, bufferMinutes: 10 });
  assert.equal(filling.trend, 'filling');
  assert.equal(filling.trendLabel, 'מתמלא');
  assert.match(filling.advice, /להקדים/);
  assert.ok(filling.drift < 0);
  const emptying = window_({ nowMinutes: at('17:00'), etaMinutes: 30, bufferMinutes: 10 });
  assert.equal(emptying.trend, 'emptying');
  assert.match(emptying.advice, /מתפנה/);
  // Flat stretch of the night curve: movement below half a bay is not advice.
  const quiet = window_({ nowMinutes: at('02:00'), etaMinutes: 5, bufferMinutes: 5 });
  assert.equal(quiet.trend, 'stable');
  assert.ok(Math.abs(quiet.drift) < margin.TREND_EPSILON);
});

test('a band that could bottom out says so instead of rounding up to a spot', () => {
  const flat = new Array(24).fill(2);
  const m = margin.arrivalMargin({ freeByHour: flat, total: 2, nowMinutes: at('09:00'), etaMinutes: 45, bufferMinutes: 30 });
  assert.equal(m.low, 0, 'slack of 5 bays against 2 free bays floors the band at zero');
  assert.equal(m.high, 2, 'and it is capped by the lot, not by the slack');
  assert.match(m.rangeLabel, /ייתכן גם אפס/);
  assert.equal(margin.rangeLabel(0, 0), 'החיזוי לא מראה מקום פנוי בחלון הזה');
  assert.deepEqual([margin.rangeLabel(1, 1), margin.rangeLabel(3, 5)], ['מקום פנוי אחד בלבד', '3–5 מקומות פנויים']);
});

test('bad input degrades to no margin, and silly asks are clamped', () => {
  for (const bad of [undefined, {}, { freeByHour: [] }, { freeByHour: new Array(24).fill(NaN) },
    { freeByHour: new Array(24).fill(-1) }, { freeByHour: new Array(23).fill(1) }]) {
    assert.equal(margin.arrivalMargin(bad), null, JSON.stringify(bad));
  }
  const wild = window_({ nowMinutes: at('10:00'), etaMinutes: 999, bufferMinutes: 999 });
  assert.deepEqual([wild.etaMinutes, wild.bufferMinutes], [margin.MAX_ETA_MIN, margin.MAX_BUFFER_MIN]);
  // Number(null) is 0, which would read as "arriving now" instead of the default.
  const missing = window_({ nowMinutes: at('10:00'), etaMinutes: 'soon', bufferMinutes: null });
  assert.deepEqual([missing.etaMinutes, missing.bufferMinutes], [margin.DEFAULT_ETA_MIN, margin.DEFAULT_BUFFER_MIN]);
  // Same ask, same window — demo screenshots stay reproducible.
  assert.deepEqual(window_({ nowMinutes: at('10:00') }), window_({ nowMinutes: at('10:00') }));
});

test('the board page wires the margin panel and keeps the prediction tone', () => {
  const html = fs.readFileSync(path.join(root, 'demo', 'atidim-board.html'), 'utf8');
  assert.match(html, /src\/lib\/margin\.js/);
  assert.match(html, /id="etaRange"[^>]*type="range"[^>]*max="45"/);
  assert.match(html, /id="bufferRange"[^>]*type="range"[^>]*max="30"/);
  for (const id of ['marginHead', 'marginBand', 'marginAdvice', 'marginTone']) {
    assert.match(html, new RegExp('id="' + id + '"'), id);
  }
  // The window is rewritten by both sliders, so it has to be announced.
  assert.match(html, /<div aria-live="polite">[\s\S]*id="marginHead"/);
  assert.match(html, /שולי הגעה/);
  assert.doesNotMatch(html, /מקום מובטח|שומר לך מקום/);
  // The window is quoted in minutes, so "now" must not round down to the hour.
  // 2026-10-19 07:34Z is 10:34 in Jerusalem.
  assert.match(html, /LOT\.localMinuteOfDay\(/);
  const d = new Date('2026-10-19T07:34:00Z');
  assert.equal(lot.localMinuteOfDay(d, lot.DEFAULT.timezone), 10 * 60 + 34);
  assert.equal(Math.floor(lot.localMinuteOfDay(d) / 60), lot.localHour(d));
  assert.deepEqual([lot.localMinuteOfDay(new Date('nope')), margin.clockLabel(lot.localMinuteOfDay(d))], [0, '10:34']);
});
