const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const occ = require('../src/lib/occupancy');
const cmp = require('../src/lib/compare');
delete globalThis.ParkWizOccupancy;
delete globalThis.ParkWizCompare;
const proto = require('../src/lib/protocol');

const samplePairs = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'pilot', 'sample-pairs.json'), 'utf8')
).map(cmp.pairObservation);

function fieldPair(i, overrides) {
  return cmp.pairObservation({
    ts: 'f' + i,
    street: 'הרצל',
    total: 12,
    systemOccupied: 5,
    manualOccupied: 5,
    source: 'field',
    ...overrides,
  });
}

test('global export and module export match', () => {
  assert.equal(globalThis.ParkWizProtocol, proto);
  assert.equal(proto.PILOT_DAYS, 30);
  assert.equal(proto.MIN_SPOT_TRIALS, 100);
  assert.equal(proto.MIN_PAIRS, 8);
  assert.equal(proto.Z95, 1.96);
  assert.deepEqual(proto.LIGHTING, ['יום', 'דמדומים', 'לילה', 'גשם / רטוב']);
  assert.equal(proto.VENDOR_CLAIMS.length, 2);
  assert.equal(proto.VENDOR_CLAIMS[0].id, 'camlytics');
  assert.equal(proto.VENDOR_CLAIMS[0].rate, 0.96);
  assert.equal(proto.VENDOR_CLAIMS[0].label, 'Camlytics');
  assert.ok(proto.VENDOR_CLAIMS[0].note.includes('הצהרת יצרן'));
  assert.equal(proto.VENDOR_CLAIMS[1].id, 'parklio');
  assert.equal(proto.VENDOR_CLAIMS[1].rate, 0.99);
  assert.equal(proto.VENDOR_CLAIMS[1].label, 'Parklio Detect');
  assert.ok(proto.VENDOR_CLAIMS[1].note.includes('הצהרת יצרן'));
});

test('UMD wrapper runs in non-CommonJS and non-globalThis browser environments', () => {
  const vm = require('node:vm');
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'protocol.js'), 'utf8');

  // Forward Stryker active mutant tracking to VM context so mutants in UMD wrapper are executed
  const strykerGlobal = globalThis.__stryker__;
  const strykerProps = {
    ...(strykerGlobal ? { __stryker__: strykerGlobal } : {}),
    ...(typeof process !== 'undefined' ? { process } : {}),
  };

  // 1. Browser context where module is undefined and root provides globals
  const browserContext = {
    ParkWizOccupancy: occ,
    ParkWizCompare: cmp,
    ...strykerProps,
  };
  vm.runInNewContext(code, browserContext);
  assert.ok(browserContext.ParkWizProtocol);
  assert.equal(browserContext.ParkWizProtocol.PILOT_DAYS, 30);

  // 2. Browser context without globalThis where 'this' receives the export
  const noGlobalThis = {
    ParkWizOccupancy: occ,
    ParkWizCompare: cmp,
    ...strykerProps,
  };
  vm.runInNewContext(
    'delete globalThis;\n' + code,
    noGlobalThis
  );
  assert.ok(noGlobalThis.ParkWizProtocol);
  assert.equal(noGlobalThis.ParkWizProtocol.PILOT_DAYS, 30);

  // 3. CommonJS sandbox where module.exports is populated via require without root fallbacks
  const cjsSandbox = {
    module: { exports: {} },
    require(id) {
      if (id === './occupancy') return occ;
      if (id === './compare') return cmp;
      throw new Error('Unknown module ' + id);
    },
    ...strykerProps,
  };
  vm.runInNewContext(code, cjsSandbox);
  assert.ok(cjsSandbox.module.exports);
  assert.equal(cjsSandbox.module.exports.PILOT_DAYS, 30);
});

test('wilsonInterval calculates confidence intervals and validates inputs', () => {
  assert.equal(proto.wilsonInterval(undefined, 10), null);
  assert.equal(proto.wilsonInterval(5, undefined), null);
  assert.equal(proto.wilsonInterval('abc', 10), null);
  assert.equal(proto.wilsonInterval(5, 'abc'), null);
  assert.equal(proto.wilsonInterval(-1, 10), null);
  assert.equal(proto.wilsonInterval(5, 0), null);
  assert.equal(proto.wilsonInterval(5, -10), null);

  const standard = proto.wilsonInterval(50, 100);
  assert.equal(standard.n, 100);
  assert.equal(standard.successes, 50);
  assert.equal(standard.p, 0.5);
  assert.equal(standard.z, 1.96);
  // Exact Wilson interval values when Z = 1.96 and p = 0.5:
  // center = 0.5, margin = 1.96 * sqrt(0.25 + 1.96^2 / 400) / 10 / (1 + 1.96^2 / 100)
  assert.ok(Math.abs(standard.lo - 0.4038315) < 1e-5);
  assert.ok(Math.abs(standard.hi - 0.5961684) < 1e-5);

  const customZ = proto.wilsonInterval(50, 100, 2.58);
  assert.equal(customZ.z, 2.58);
  assert.ok(customZ.lo < standard.lo);
  assert.ok(customZ.hi > standard.hi);

  const fallbackZZero = proto.wilsonInterval(50, 100, 0);
  assert.equal(fallbackZZero.z, 1.96);
  const fallbackZNegative = proto.wilsonInterval(50, 100, -1);
  assert.equal(fallbackZNegative.z, 1.96);
  const fallbackZNaN = proto.wilsonInterval(50, 100, NaN);
  assert.equal(fallbackZNaN.z, 1.96);

  const zeroSuccess = proto.wilsonInterval(0, 100);
  assert.equal(zeroSuccess.p, 0);
  assert.equal(zeroSuccess.lo, 0);
  assert.ok(zeroSuccess.hi > 0);

  const overflowSuccess = proto.wilsonInterval(150, 100);
  assert.equal(overflowSuccess.p, 1);
  assert.ok(overflowSuccess.lo < 1);
  assert.ok(Math.abs(overflowSuccess.hi - 1) < 1e-12);
});

test('pooledAgreement handles empty, malformed, and valid pairs', () => {
  assert.deepEqual(proto.pooledAgreement(null), {
    trials: 0,
    agree: 0,
    rate: null,
    meanSignedError: null,
    wilson: null,
  });
  assert.deepEqual(proto.pooledAgreement([]), {
    trials: 0,
    agree: 0,
    rate: null,
    meanSignedError: null,
    wilson: null,
  });
  assert.deepEqual(
    proto.pooledAgreement([null, {}, { total: 0 }, { total: -5 }, { total: 'invalid' }]),
    {
      trials: 0,
      agree: 0,
      rate: null,
      meanSignedError: null,
      wilson: null,
    }
  );

  const skippedMissingCounts = proto.pooledAgreement([
    { total: 10, systemOccupied: 'bad', manualOccupied: 5 },
    { total: 10, systemOccupied: 5, manualOccupied: 'bad' },
    { total: 10, systemOccupied: undefined, manualOccupied: 5 },
    { total: 0, systemOccupied: 5, manualOccupied: 1 },
  ]);
  assert.equal(skippedMissingCounts.trials, 0);

  const result = proto.pooledAgreement([
    { total: 10, systemOccupied: 8, manualOccupied: 6 },
    { total: 20, systemOccupied: 15, manualOccupied: 14 },
    { total: 0, systemOccupied: 5, manualOccupied: 1 },
  ]);
  assert.equal(result.trials, 30);
  assert.equal(result.agree, 27);
  assert.equal(result.rate, 27 / 30);
  // signed error: (8 - 6) + (15 - 14) = 2 + 1 = 3 over 2 counted pairs = 1.5
  assert.equal(result.meanSignedError, 1.5);
  assert.ok(result.wilson);
  assert.equal(result.wilson.n, 30);
  assert.equal(result.wilson.successes, 27);
});

test('dayMs parses valid calendar dates and rejects invalid or non-existent dates', () => {
  assert.ok(Number.isNaN(proto.dayMs(null)));
  assert.ok(Number.isNaN(proto.dayMs(undefined)));
  assert.ok(Number.isNaN(proto.dayMs(12345)));
  assert.ok(Number.isNaN(proto.dayMs({})));
  assert.ok(Number.isNaN(proto.dayMs('')));
  assert.ok(Number.isNaN(proto.dayMs('not-a-date')));
  assert.ok(Number.isNaN(proto.dayMs('2026/08/01')));
  assert.ok(Number.isNaN(proto.dayMs('2026-00-01')));
  assert.ok(Number.isNaN(proto.dayMs('2026-13-01')));
  assert.ok(Number.isNaN(proto.dayMs('2026-13-15')));
  assert.ok(Number.isNaN(proto.dayMs('2026-02-29')));
  assert.ok(Number.isNaN(proto.dayMs('2026-02-31')));
  assert.ok(Number.isNaN(proto.dayMs('2026-04-31')));
  assert.ok(Number.isNaN(proto.dayMs('prefix2026-08-01')));

  assert.equal(proto.dayMs('2024-02-29'), Date.UTC(2024, 1, 29));
  assert.equal(proto.dayMs('2026-08-01'), Date.UTC(2026, 7, 1));
});

test('addDays adds days with proper zero-padding and handles invalid inputs', () => {
  assert.equal(proto.addDays('invalid', 1), '');
  assert.equal(proto.addDays('2026-02-29', 1), '');
  assert.equal(proto.addDays('2026-01-05', 0), '2026-01-05');
  assert.equal(proto.addDays('2026-01-05', 5), '2026-01-10');
  assert.equal(proto.addDays('2026-01-05', -1), '2026-01-04');
  assert.equal(proto.addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(proto.addDays('2026-12-31', 1), '2027-01-01');
});

test('emptyDay returns a clean template', () => {
  const withDate = proto.emptyDay(5, '2026-08-05');
  assert.deepEqual(withDate, {
    day: 5,
    date: '2026-08-05',
    lighting: '',
    total: null,
    systemOccupied: null,
    manualOccupied: null,
    note: '',
    source: '',
  });

  const withoutDate = proto.emptyDay(1, null);
  assert.equal(withoutDate.date, '');
});

test('normalizeDay validates day ranges, handles total <= 0, and clamps counts', () => {
  assert.equal(proto.normalizeDay(null), null);
  assert.equal(proto.normalizeDay('not an object'), null);
  assert.equal(proto.normalizeDay(123), null);
  const fn = () => {};
  fn.day = 1;
  assert.equal(proto.normalizeDay(fn), null);
  assert.equal(proto.normalizeDay({ day: 'foo' }), null);
  assert.equal(proto.normalizeDay({ day: 0 }), null);
  assert.equal(proto.normalizeDay({ day: 31 }), null);
  assert.equal(proto.normalizeDay({ day: 2.5 }), null);
  assert.equal(proto.normalizeDay({ day: 1, total: 0 }), null);
  assert.equal(proto.normalizeDay({ day: 1, total: -5 }), null);

  const fallbackOccupied = proto.normalizeDay({
    day: 1,
    total: 10,
    occupied: 6,
  });
  assert.equal(fallbackOccupied.systemOccupied, 6);

  const zeroSystemOccupied = proto.normalizeDay({
    day: 1,
    total: 10,
    systemOccupied: 0,
    occupied: 6,
  });
  assert.equal(zeroSystemOccupied.systemOccupied, 0);

  const nullSysWithTotal = proto.normalizeDay({
    day: 1,
    total: 10,
    systemOccupied: null,
    manualOccupied: null,
  });
  assert.equal(nullSysWithTotal.systemOccupied, null);
  assert.equal(nullSysWithTotal.manualOccupied, null);

  const blankCounts = proto.normalizeDay({
    day: 2,
    total: '',
    systemOccupied: '',
    manualOccupied: '',
    date: null,
    lighting: null,
    note: null,
    source: null,
  });
  assert.equal(blankCounts.total, null);
  assert.equal(blankCounts.systemOccupied, null);
  assert.equal(blankCounts.manualOccupied, null);
  assert.equal(blankCounts.date, '');
  assert.equal(blankCounts.lighting, '');
  assert.equal(blankCounts.note, '');
  assert.equal(blankCounts.source, '');

  const clamped = proto.normalizeDay({
    day: 30,
    date: 20260830,
    lighting: 'לילה',
    total: 10,
    systemOccupied: 99,
    manualOccupied: -5,
    note: 42,
    source: 'test-source',
  });
  assert.equal(clamped.day, 30);
  assert.equal(clamped.date, '20260830');
  assert.equal(clamped.lighting, 'לילה');
  assert.equal(clamped.total, 10);
  assert.equal(clamped.systemOccupied, 10);
  assert.equal(clamped.manualOccupied, 0);
  assert.equal(clamped.note, '42');
  assert.equal(clamped.source, 'test-source');

  const unClampedWhenTotalNull = proto.normalizeDay({
    day: 3,
    total: null,
    systemOccupied: 50,
    manualOccupied: -10,
  });
  assert.equal(unClampedWhenTotalNull.total, null);
  assert.equal(unClampedWhenTotalNull.systemOccupied, 50);
  assert.equal(unClampedWhenTotalNull.manualOccupied, -10);
});

test('buildCalendar creates fixed length calendar and handles invalid dates or days', () => {
  const def = proto.buildCalendar();
  assert.equal(def.length, 30);
  assert.equal(def[0].date, '');

  const zeroDays = proto.buildCalendar('2026-08-01', 0);
  assert.equal(zeroDays.length, 30);

  const invalidDays = proto.buildCalendar('2026-08-01', -5);
  assert.equal(invalidDays.length, 30);
  const nanDays = proto.buildCalendar('2026-08-01', 'foo');
  assert.equal(nanDays.length, 30);

  const cappedDays = proto.buildCalendar('2026-08-01', 50);
  assert.equal(cappedDays.length, 30);

  const custom = proto.buildCalendar('2026-08-01T12:00:00Z', 5);
  assert.equal(custom.length, 5);
  assert.equal(custom[0].date, '2026-08-01');
  assert.equal(custom[4].date, '2026-08-05');

  const sliced = proto.buildCalendar('2026-08-01-extra-chars', 1);
  assert.equal(sliced[0].date, '2026-08-01');

  const invalidDate = proto.buildCalendar('not-a-date', 3);
  assert.equal(invalidDate.length, 3);
  assert.equal(invalidDate[0].date, '');

  const prefixDate = proto.buildCalendar('prefix-2026-08-01', 2);
  assert.equal(prefixDate[0].date, '');

  const singleDigitDay = proto.buildCalendar('2026-08-1', 2);
  assert.equal(singleDigitDay[0].date, '');

  const impossibleDate = proto.buildCalendar('2026-02-31', 2);
  assert.equal(impossibleDate[0].date, '');

  const nullDate = proto.buildCalendar(null, 2);
  assert.equal(nullDate[0].date, '');
});

test('mergeLog merges incoming days, handles empty calendar, and sorts days', () => {
  const mergedFromEmpty = proto.mergeLog(null, [
    { day: 5, date: '2026-08-05', total: 10, systemOccupied: 3, manualOccupied: 4 },
  ]);
  assert.equal(mergedFromEmpty.length, 30);
  assert.equal(mergedFromEmpty[0].date, '');
  assert.equal(mergedFromEmpty[4].day, 5);
  assert.equal(mergedFromEmpty[4].total, 10);

  const cal = proto.buildCalendar('2026-08-01', 5);
  const baseWithInvalidEntry = [{ day: 0, date: '2026-08-01' }, null];
  const mergedFallback = proto.mergeLog(baseWithInvalidEntry, []);
  assert.equal(mergedFallback.length, 2);
  assert.equal(mergedFallback[0].day, 1);
  assert.equal(mergedFallback[0].date, '2026-08-01');
  assert.equal(mergedFallback[1].day, 2);
  assert.equal(mergedFallback[1].date, '');

  const merged = proto.mergeLog(cal, [
    { day: 2, total: 12, systemOccupied: 5, manualOccupied: 5 },
    { day: 1, date: '2026-08-99', total: 10, systemOccupied: 2, manualOccupied: 2 },
    { day: 99, total: 10 },
  ]);
  assert.equal(merged[1].day, 2);
  assert.equal(merged[1].date, '2026-08-02');
  assert.equal(merged[1].total, 12);
  assert.equal(merged[0].date, '2026-08-99');
  assert.equal(merged.length, 5);

  const outOfOrderBase = [{ day: 5, date: '' }];
  const sortedResult = proto.mergeLog(outOfOrderBase, [{ day: 10 }, { day: 2 }]);
  assert.deepEqual(
    sortedResult.map((d) => d.day),
    [2, 5, 10]
  );

  const mergedNoIncoming = proto.mergeLog(cal, null);
  assert.equal(mergedNoIncoming.length, 5);
});

test('parseLog handles JSON array, JSON object with days, and invalid input', () => {
  assert.deepEqual(proto.parseLog(''), []);
  assert.deepEqual(proto.parseLog(null), []);
  assert.deepEqual(proto.parseLog('{ not valid json'), []);
  assert.deepEqual(proto.parseLog('{"other": 123}'), []);
  assert.deepEqual(proto.parseLog('null'), []);
  assert.deepEqual(proto.parseLog('123'), []);
  assert.deepEqual(proto.parseLog('"string"'), []);
  assert.deepEqual(proto.parseLog('true'), []);
  assert.deepEqual(proto.parseLog('{"days": null}'), []);
  assert.deepEqual(proto.parseLog('{"days": "bad"}'), []);

  const arrayJson = JSON.stringify([
    { day: 2, total: 10, systemOccupied: 1, manualOccupied: 1 },
    { day: 1, total: 10, systemOccupied: 2, manualOccupied: 2 },
    { day: 0, total: 10 },
  ]);
  const parsedArray = proto.parseLog(arrayJson);
  assert.equal(parsedArray.length, 2);
  assert.equal(parsedArray[0].day, 1);
  assert.equal(parsedArray[1].day, 2);

  const objectJson = JSON.stringify({
    days: [
      { day: 10, total: 10, systemOccupied: 3, manualOccupied: 3 },
      { day: 5, total: 10, systemOccupied: 4, manualOccupied: 4 },
    ],
  });
  const parsedObject = proto.parseLog(objectJson);
  assert.equal(parsedObject.length, 2);
  assert.equal(parsedObject[0].day, 5);
  assert.equal(parsedObject[1].day, 10);
});

test('filledDays filters days missing required metrics', () => {
  assert.deepEqual(proto.filledDays(null), []);
  assert.deepEqual(proto.filledDays([]), []);

  const days = [
    null,
    { day: 1, total: null, systemOccupied: 1, manualOccupied: 1 },
    { day: 2, total: 10, systemOccupied: null, manualOccupied: 1 },
    { day: 3, total: 10, systemOccupied: 1, manualOccupied: null },
    { day: 4, total: 10, systemOccupied: 0, manualOccupied: 0 },
  ];
  const filled = proto.filledDays(days);
  assert.equal(filled.length, 1);
  assert.equal(filled[0].day, 4);
});

test('dayToPair formats observations, notes, dates, and defaults', () => {
  assert.equal(proto.dayToPair(null), null);
  assert.equal(proto.dayToPair({ day: 1, total: null, systemOccupied: 5, manualOccupied: 5 }), null);
  assert.equal(proto.dayToPair({ day: 1, total: 10, systemOccupied: null, manualOccupied: 5 }), null);
  assert.equal(proto.dayToPair({ day: 1, total: 10, systemOccupied: 5, manualOccupied: null }), null);

  const full = proto.dayToPair(
    {
      day: 3,
      date: '2026-08-03',
      total: 15,
      systemOccupied: 5,
      manualOccupied: 7,
      lighting: 'לילה',
      note: 'גשם',
      source: 'manual-pilot',
    },
    'הרצל'
  );
  assert.equal(full.ts, '2026-08-03T12:00:00');
  assert.equal(full.street, 'הרצל');
  assert.equal(full.note, 'לילה · גשם');
  assert.equal(full.source, 'manual-pilot');

  const minimal = proto.dayToPair({
    day: 7,
    date: '',
    total: 10,
    systemOccupied: 2,
    manualOccupied: 2,
    lighting: '',
    note: '',
    source: '',
  });
  assert.equal(minimal.ts, 'day-7');
  assert.equal(minimal.street, '—');
  assert.equal(minimal.note, '');
  assert.equal(minimal.source, 'field');

  const lightingOnly = proto.dayToPair({
    day: 8,
    total: 10,
    systemOccupied: 2,
    manualOccupied: 2,
    lighting: 'יום',
    note: '',
  });
  assert.equal(lightingOnly.note, 'יום');

  const noteOnly = proto.dayToPair({
    day: 9,
    total: 10,
    systemOccupied: 2,
    manualOccupied: 2,
    lighting: '',
    note: 'בדיקה',
  });
  assert.equal(noteOnly.note, 'בדיקה');
});

test('logToPairs converts filled days to pairs', () => {
  assert.deepEqual(proto.logToPairs(null), []);
  const list = [
    { day: 1, total: 10, systemOccupied: 5, manualOccupied: 5 },
    { day: 2, total: null },
  ];
  const pairs = proto.logToPairs(list, 'ביאליק');
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].street, 'ביאליק');
});

test('daysSince calculates difference across date formats and types', () => {
  assert.equal(proto.daysSince('invalid-day', new Date()), null);
  assert.equal(proto.daysSince('2026-08-01', 'not-a-date'), null);
  assert.equal(proto.daysSince('2026-08-01', NaN), null);

  const asDate = new Date(Date.UTC(2026, 7, 11, 12));
  assert.equal(proto.daysSince('2026-08-01', asDate), 10);
  assert.equal(proto.daysSince('2026-08-01', asDate.getTime()), 10);
  assert.equal(proto.daysSince('2026-08-01', '2026-08-11T12:00:00Z'), 10);
});

test('decidePilot handles null input and returns standard schema', () => {
  const v = proto.decidePilot(null);
  assert.equal(v.code, 'INSUFFICIENT');
  assert.equal(v.label, 'מדגם קטן מדי — ממשיכים לאסוף.');
  assert.deepEqual(v.reasons, [
    'צריך לפחות 8 זוגות ו־100 השוואות מקום (יש 0 זוגות, 0 מקומות).',
    'אין בפסק הדין הזה המלצת אכיפה או זיהוי לוחיות.',
  ]);
  assert.equal(v.summary.count, 0);
  assert.equal(v.pooled.trials, 0);
  assert.equal(v.hasCalibrationPlan, false);
  assert.equal(v.cameraAccess, false);
  assert.equal(v.integratorAsk, false);
  assert.equal(v.outreachSentAt, '');
  assert.equal(v.daysSinceOutreach, null);
  assert.equal(v.vendorClaims, proto.VENDOR_CLAIMS);
  assert.equal(v.minSpotTrials, proto.MIN_SPOT_TRIALS);
  assert.equal(v.minPairs, proto.MIN_PAIRS);

  const withOptions = proto.decidePilot({
    hasCalibrationPlan: true,
    cameraAccess: true,
    integratorAsk: true,
    outreachSentAt: '2026-07-01',
    now: '2026-07-11T00:00:00Z',
  });
  assert.equal(withOptions.code, 'INSUFFICIENT');
  assert.equal(withOptions.hasCalibrationPlan, true);
  assert.equal(withOptions.cameraAccess, true);
  assert.equal(withOptions.integratorAsk, true);
  assert.equal(withOptions.outreachSentAt, '2026-07-01');
  assert.equal(withOptions.daysSinceOutreach, 10);

  const emptyInput = proto.decidePilot({});
  assert.equal(emptyInput.code, 'INSUFFICIENT');
  assert.equal(emptyInput.summary.count, 0);

  const nonArrayPairs = proto.decidePilot({ pairs: 'not-an-array' });
  assert.equal(nonArrayPairs.code, 'INSUFFICIENT');
  assert.equal(nonArrayPairs.summary.count, 0);

  const numberPairs = proto.decidePilot({ pairs: 42 });
  assert.equal(numberPairs.code, 'INSUFFICIENT');
  assert.equal(numberPairs.summary.count, 0);
});

test('decidePilot handles null elements inside pairs array', () => {
  const v = proto.decidePilot({ pairs: [null, fieldPair(0)] });
  assert.equal(v.code, 'INSUFFICIENT');
  assert.equal(v.summary.count, 1);
});

test('decidePilot count and trials boundaries for INSUFFICIENT', () => {
  // 7 pairs with 15 trials each = 105 trials (count 7 < 8, trials >= 100)
  const sevenPairs = [];
  for (let i = 0; i < 7; i++) {
    sevenPairs.push(fieldPair(i, { total: 15 }));
  }
  const v7 = proto.decidePilot({ pairs: sevenPairs });
  assert.equal(v7.code, 'INSUFFICIENT');
  assert.equal(v7.label, 'מדגם קטן מדי — ממשיכים לאסוף.');
  assert.ok(
    v7.reasons.includes('צריך לפחות 8 זוגות ו־100 השוואות מקום (יש 7 זוגות, 105 מקומות).')
  );

  // 8 pairs with 12 trials each = 96 trials (count 8 >= 8, trials 96 < 100)
  const eightSmallPairs = [];
  for (let i = 0; i < 8; i++) {
    eightSmallPairs.push(fieldPair(i, { total: 12 }));
  }
  const v96 = proto.decidePilot({ pairs: eightSmallPairs });
  assert.equal(v96.code, 'INSUFFICIENT');
  assert.ok(
    v96.reasons.includes('צריך לפחות 8 זוגות ו־100 השוואות מקום (יש 8 זוגות, 96 מקומות).')
  );

  // 8 pairs with trials totaling exactly 100 (7 * 12 + 16 = 100) -> trials >= 100 and pairs >= 8 -> CONTINUE
  const exactHundredPairs = [];
  for (let i = 0; i < 7; i++) {
    exactHundredPairs.push(fieldPair(i, { total: 12 }));
  }
  exactHundredPairs.push(fieldPair(7, { total: 16 }));
  const v100 = proto.decidePilot({ pairs: exactHundredPairs });
  assert.equal(v100.code, 'CONTINUE');
  assert.equal(v100.summary.count, 8);
  assert.equal(v100.pooled.trials, 100);
  assert.equal(v100.outreachSentAt, '');
  assert.deepEqual(v100.reasons, [
    'הסכם מול פקח על הסדרה הזו הוא 100% — מעל הצהרת Camlytics, עדיין לא מדידת מצלמה חיה.',
    'אין בפסק הדין הזה המלצת אכיפה או זיהוי לוחיות.',
  ]);
});

test('decidePilot branches: PARK_ACCURACY vs CONTINUE with calibration plan', () => {
  const lowAccPairs = [];
  for (let i = 0; i < 10; i++) {
    lowAccPairs.push(
      fieldPair(i, {
        total: 12,
        systemOccupied: 2,
        manualOccupied: 10,
      })
    );
  }

  const parkAcc = proto.decidePilot({
    pairs: lowAccPairs,
    hasCalibrationPlan: false,
  });
  assert.equal(parkAcc.code, 'PARK_ACCURACY');
  assert.equal(parkAcc.label, 'PARK — הדיוק מתחת להצהרת יצרן ואין תוכנית כיול.');
  assert.ok(parkAcc.reasons.some((r) => r.includes('הסכם מול פקח הוא 33%')));
  assert.ok(
    parkAcc.reasons.some((r) =>
      r.includes(', מתחת ל־96% ש־Camlytics מצהירה (הצהרת יצרן, לא רף מדעי).')
    )
  );
  assert.ok(
    parkAcc.reasons.includes('בלי תוכנית כיול פר־מצלמה כלל העצירה ב־RESEARCH.md אומר PARK מיד.')
  );

  const continueWithPlan = proto.decidePilot({
    pairs: lowAccPairs,
    hasCalibrationPlan: true,
  });
  assert.equal(continueWithPlan.code, 'CONTINUE');
  assert.equal(continueWithPlan.label, 'ממשיכים את הפיילוט.');
  assert.ok(
    continueWithPlan.reasons.includes(
      'הדיוק מתחת להצהרת יצרן, אבל סומנה תוכנית כיול פר־מצלמה — ממשיכים למדוד, לא PARK אוטומטי.'
    )
  );
});

test('decidePilot branches: PARK_NO_ACCESS vs cameraAccess and integratorAsk', () => {
  const goodPairs = [];
  for (let i = 0; i < 10; i++) goodPairs.push(fieldPair(i));

  // Exactly 30 days
  const park30Days = proto.decidePilot({
    pairs: goodPairs,
    outreachSentAt: '2026-07-01',
    now: '2026-07-31T00:00:00Z',
    cameraAccess: false,
    integratorAsk: false,
  });
  assert.equal(park30Days.code, 'PARK_NO_ACCESS');
  assert.equal(park30Days.label, 'PARK — 30 יום מהפנייה בלי גישת מצלמה ובלי בקשת דמו.');
  assert.equal(park30Days.daysSinceOutreach, 30);
  assert.ok(
    park30Days.reasons.includes(
      'חלפו 30 ימים מאז תאריך הפנייה שסומן, בלי גישת snapshot ובלי פנייה מאינטגרטור.'
    )
  );

  // 29 days (less than PILOT_DAYS 30)
  const continue29Days = proto.decidePilot({
    pairs: goodPairs,
    outreachSentAt: '2026-07-01',
    now: '2026-07-30T00:00:00Z',
    cameraAccess: false,
    integratorAsk: false,
  });
  assert.equal(continue29Days.code, 'CONTINUE');

  const continueCamera = proto.decidePilot({
    pairs: goodPairs,
    outreachSentAt: '2026-07-01',
    now: '2026-08-15T00:00:00Z',
    cameraAccess: true,
    integratorAsk: false,
  });
  assert.equal(continueCamera.code, 'CONTINUE');

  const continueIntegrator = proto.decidePilot({
    pairs: goodPairs,
    outreachSentAt: '2026-07-01',
    now: '2026-08-15T00:00:00Z',
    cameraAccess: false,
    integratorAsk: true,
  });
  assert.equal(continueIntegrator.code, 'CONTINUE');

  // Exact 0.96 agreement rate continues and reports camlytics threshold reason
  // 8 pairs of 25 = 200 trials. 8 errors: agree = 192, 192 / 200 = 0.96
  const rate96Pairs = [];
  for (let i = 0; i < 8; i++) {
    rate96Pairs.push(
      fieldPair(i, {
        total: 25,
        systemOccupied: 10,
        manualOccupied: 9, // 1 error per pair = 8 errors total
      })
    );
  }
  const v96Rate = proto.decidePilot({
    pairs: rate96Pairs,
    hasCalibrationPlan: false,
  });
  assert.equal(v96Rate.code, 'CONTINUE');
  assert.equal(v96Rate.pooled.rate, 0.96);
  assert.ok(
    v96Rate.reasons.includes(
      'הסכם מול פקח על הסדרה הזו הוא 96% — מעל הצהרת Camlytics, עדיין לא מדידת מצלמה חיה.'
    )
  );
});

test('loadStoredLog and saveLog safely interact with localStorage and handle errors', () => {
  const originalLocalStorage = globalThis.localStorage;
  try {
    delete globalThis.localStorage;
    assert.deepEqual(proto.loadStoredLog(), []);
    assert.doesNotThrow(() => proto.saveLog([{ day: 1 }]));

    const store = new Map();
    globalThis.localStorage = {
      getItem(key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        store.set(key, String(value));
      },
    };

    assert.deepEqual(proto.loadStoredLog(), []);

    const listToSave = [
      { day: 1, total: 10, systemOccupied: 4, manualOccupied: 4 },
      { day: 2, total: 10, systemOccupied: 5, manualOccupied: 5 },
    ];
    proto.saveLog(listToSave);
    assert.equal(store.get(occ.LS.log), JSON.stringify(listToSave));

    const loaded = proto.loadStoredLog();
    assert.equal(loaded.length, 2);
    assert.equal(loaded[0].day, 1);
    assert.equal(loaded[1].day, 2);

    proto.saveLog(null);
    assert.equal(store.get(occ.LS.log), '[]');

    globalThis.localStorage.getItem = () => {
      throw new Error('Storage disabled');
    };
    assert.deepEqual(proto.loadStoredLog(), []);

    globalThis.localStorage.setItem = () => {
      throw new Error('Quota exceeded');
    };
    assert.doesNotThrow(() => proto.saveLog([{ day: 1 }]));
  } finally {
    if (originalLocalStorage !== undefined) {
      globalThis.localStorage = originalLocalStorage;
    } else {
      delete globalThis.localStorage;
    }
  }
});

test('one field pair typed over a sample series stays INSUFFICIENT', () => {
  const v = proto.decidePilot({ pairs: samplePairs.concat([fieldPair(0)]) });
  assert.equal(v.code, 'INSUFFICIENT');
  assert.equal(v.summary.count, 1);
  assert.equal(v.pooled.trials, 12);
  assert.ok(v.reasons.some((r) => r.startsWith(samplePairs.length + ' זוגות דוגמה')));
});

test('sample pairs do not drag a good field series into PARK_ACCURACY', () => {
  const bad = [];
  for (let i = 0; i < 10; i++) {
    bad.push(
      cmp.pairObservation({
        ts: 's' + i,
        street: 'הרצל',
        total: 12,
        systemOccupied: 2,
        manualOccupied: 10,
        source: 'sample',
      })
    );
  }
  const field = [];
  for (let i = 0; i < 10; i++) field.push(fieldPair(i));
  const v = proto.decidePilot({ pairs: bad.concat(field) });
  assert.equal(v.code, 'CONTINUE');
  assert.equal(v.pooled.rate, 1);
});

test('a pure sample series is still SAMPLE_ONLY with its own summary', () => {
  const v = proto.decidePilot({ pairs: samplePairs });
  assert.equal(v.code, 'SAMPLE_ONLY');
  assert.equal(v.label, 'סדרת דוגמה — אין פסק דין שטח.');
  assert.equal(v.summary.count, samplePairs.length);
  assert.ok(
    v.reasons.includes('כל הזוגות מסומנים sample. כלל העצירה חל רק על ספירת פקח אמיתית.')
  );
  assert.ok(!v.reasons.some((r) => r.includes('לא נספרו')));
});
