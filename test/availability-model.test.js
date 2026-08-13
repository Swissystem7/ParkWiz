const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../availability-model.js');

const baselineInput = {
  baseline: 70,
  streetIdx: 1,
  areaKey: 'netanya-center',
  reports: [],
  now: new Date('2026-07-14T18:00:00+03:00'),
};

test('same input always returns identical output', () => {
  const first = model.calculate(baselineInput);
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(model.calculate(baselineInput), first);
  }
});

test('weekday evening, Friday morning, and late night produce different scores with reasons', () => {
  const weekdayEvening = model.calculate({ ...baselineInput, now: new Date('2026-07-14T18:00:00+03:00') });
  const fridayMorning = model.calculate({ ...baselineInput, now: new Date('2026-07-17T09:00:00+03:00') });
  const lateNight = model.calculate({ ...baselineInput, now: new Date('2026-07-15T23:30:00+03:00') });

  assert.equal(weekdayEvening.score, 50);
  assert.equal(fridayMorning.score, 62);
  assert.equal(lateNight.score, 82);

  const labelFor = (result) => result.factors.find((factor) => factor.type === 'time').label;
  assert.match(labelFor(weekdayEvening), /ערב אמצע שבוע/);
  assert.match(labelFor(fridayMorning), /בוקר יום שישי/);
  assert.match(labelFor(lateNight), /שעות לילה מאוחרות/);
});

test('expired report has zero impact on score', () => {
  const createdAt = Date.parse('2026-07-14T17:55:00+03:00');
  const expired = {
    source: 'user',
    streetIdx: 1,
    areaKey: 'netanya-center',
    count: 3,
    confidence: 0.9,
    createdAt,
    expiresAt: createdAt + 5 * 60 * 1000,
  };
  const now = new Date(createdAt + 6 * 60 * 1000);

  const base = model.calculate({ baseline: 70, streetIdx: 1, areaKey: 'netanya-center', reports: [], now });
  const withExpired = model.calculate({ baseline: 70, streetIdx: 1, areaKey: 'netanya-center', reports: [expired], now });

  assert.equal(withExpired.score, base.score);
  assert.equal(withExpired.validReportCount, 0);
});

test('report for one street does not affect another street in the same area', () => {
  const createdAt = Date.parse('2026-07-14T17:58:00+03:00');
  const reportForStreetZero = {
    source: 'user',
    streetIdx: 0,
    areaKey: 'netanya-center',
    count: 2,
    confidence: 0.8,
    createdAt,
    expiresAt: createdAt + 5 * 60 * 1000,
  };
  const now = new Date(createdAt + 3 * 60 * 1000);

  const baseStreetOne = model.calculate({ baseline: 70, streetIdx: 1, areaKey: 'netanya-center', reports: [], now });
  const withOtherStreetReport = model.calculate({
    baseline: 70,
    streetIdx: 1,
    areaKey: 'netanya-center',
    reports: [reportForStreetZero],
    now,
  });

  assert.equal(withOtherStreetReport.score, baseStreetOne.score);
  assert.equal(withOtherStreetReport.validReportCount, 0);
});

test('confidence rises only when there is a valid unexpired report', () => {
  const createdAt = Date.parse('2026-07-14T17:58:00+03:00');
  const valid = {
    source: 'user',
    streetIdx: 1,
    areaKey: 'netanya-center',
    count: 2,
    confidence: 0.8,
    createdAt,
    expiresAt: createdAt + 5 * 60 * 1000,
  };
  const expired = { ...valid, expiresAt: createdAt + 2 * 60 * 1000 };
  const now = new Date(createdAt + 3 * 60 * 1000);

  const noReports = model.calculate({ baseline: 70, streetIdx: 1, areaKey: 'netanya-center', reports: [], now });
  const withExpired = model.calculate({ baseline: 70, streetIdx: 1, areaKey: 'netanya-center', reports: [expired], now });
  const withValid = model.calculate({ baseline: 70, streetIdx: 1, areaKey: 'netanya-center', reports: [valid], now });

  assert.equal(noReports.confidence, withExpired.confidence);
  assert.ok(withValid.confidence > noReports.confidence);
});

test('score is always clamped to legal range', () => {
  const high = model.calculate({
    baseline: 200,
    streetIdx: 1,
    areaKey: 'netanya-center',
    now: new Date('2026-07-18T13:00:00Z'),
    reports: [],
  });
  const low = model.calculate({
    baseline: -40,
    streetIdx: 1,
    areaKey: 'netanya-center',
    now: new Date('2026-07-18T13:00:00Z'),
    reports: [],
  });

  assert.equal(high.score, 100);
  assert.equal(low.score, 0);
});
