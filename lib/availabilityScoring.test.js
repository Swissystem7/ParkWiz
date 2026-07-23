'use strict';

const assert = require('node:assert');
const {
  DEFAULT_TTL_MS,
  scoreAvailability,
} = require('./availabilityScoring.js');

const now = 2_000_000_000_000;
const input = { area: 'Levinsky', hour: 17, weekday: 2, nowMs: now };

const firstEstimate = scoreAvailability(input);
const secondEstimate = scoreAvailability(input);
assert.deepStrictEqual(firstEstimate, secondEstimate);
assert.strictEqual(firstEstimate.kind, 'demo-estimate');
assert.strictEqual(firstEstimate.confidence, undefined);
assert.strictEqual(firstEstimate.expiresAt, undefined);
assert.strictEqual(firstEstimate.ttlRemainingMs, undefined);

const demoReport = {
  source: 'demo',
  area: 'Levinsky',
  available: true,
  reportedAt: now - 1,
};
assert.deepStrictEqual(
  scoreAvailability({ ...input, reports: [demoReport] }),
  firstEstimate
);

const activeReport = {
  source: 'user',
  area: 'LEVINSKY',
  available: true,
  reportedAt: now - DEFAULT_TTL_MS + 1,
};
const reported = scoreAvailability({ ...input, reports: [activeReport] });
assert.strictEqual(reported.kind, 'user-report');
assert.strictEqual(reported.confidence, 55);
assert.strictEqual(reported.ttlRemainingMs, 1);
assert.strictEqual(reported.reportCount, 1);

const boundaryExpiredReport = {
  ...activeReport,
  reportedAt: now - DEFAULT_TTL_MS,
};
assert.deepStrictEqual(
  scoreAvailability({ ...input, reports: [boundaryExpiredReport] }),
  firstEstimate
);

const futureReport = { ...activeReport, reportedAt: now + 1 };
assert.deepStrictEqual(
  scoreAvailability({ ...input, reports: [futureReport] }),
  firstEstimate
);

assert.notStrictEqual(
  scoreAvailability({ ...input, hour: 8 }).score,
  scoreAvailability({ ...input, hour: 12 }).score
);

console.log('availability scoring tests: ok');
