const assert = require('node:assert/strict');
const model = require('../availability-model.js');

const mondayEvening = new Date('2026-07-13T18:00:00+03:00');
const base = model.calculate({ baseline: 70, streetIdx: 0, now: mondayEvening });
assert.equal(base.score, 50);
assert.equal(base.confidence, 0.35);

const createdAt = mondayEvening.getTime() - 60_000;
const reports = [{ source: 'user', streetIdx: 0, count: 2, createdAt, expiresAt: createdAt + 5 * 60_000 }];
const withReport = model.calculate({ baseline: 70, streetIdx: 0, reports, now: mondayEvening });
assert.equal(withReport.score, 62);
assert.equal(withReport.confidence, 0.45);
assert.equal(withReport.validReportCount, 1);

const expired = model.calculate({ baseline: 70, streetIdx: 0, reports, now: new Date(createdAt + 6 * 60_000) });
assert.equal(expired.validReportCount, 0);

assert.equal(model.calculate({ baseline: 99, streetIdx: 0, now: new Date('2026-07-13T23:30:00+03:00') }).score, 100);
assert.equal(model.calculate({ baseline: 2, streetIdx: 0, now: mondayEvening }).score, 0);
assert.equal(withReport.modelVersion, 'pw-availability-1');

console.log('availability-model: all deterministic tests passed');
