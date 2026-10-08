const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const model = require('../availability-model.js');

// getModelOutput lives inline in index.html. Run that block in a sandbox with
// the real model so the test covers the shipped code, not a copy of it.
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('const AVAILABILITY_MODEL = window.ParkWizAvailability;');
const end = html.indexOf('// STREET_HOURLY replacement', start);
assert.ok(start >= 0 && end > start, 'getModelOutput block not found in index.html');

function loadBlock(nowMs) {
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [nowMs])); }
    static now() { return nowMs; }
  }
  const sandbox = {
    window: { ParkWizAvailability: model },
    STREET_BASELINE_AVAILABILITY: [60, 60],
    Date: FakeDate,
  };
  vm.createContext(sandbox);
  vm.runInContext(html.slice(start, end)
    + '\nthis.api = { getModelOutput, push: (r) => USER_REPORTS.push(r), count: () => USER_REPORTS.length };', sandbox);
  return sandbox.api;
}

const NOW = Date.parse('2026-07-14T18:00:00+03:00');
const liveReport = {
  source: 'user',
  streetIdx: 1,
  areaKey: 'netanya-center',
  count: 2,
  confidence: 0.9,
  createdAt: NOW - 60 * 1000,
  expiresAt: NOW + 4 * 60 * 1000,
};

test('asking about a future slot does not delete reports that are live now', () => {
  const api = loadBlock(NOW);
  api.push({ ...liveReport });

  api.getModelOutput(1, new Date(NOW + 14 * 60 * 60 * 1000));

  assert.equal(api.count(), 1);
  assert.equal(api.getModelOutput(1, new Date(NOW)).validReportCount, 1);
});

test('a future slot still ignores a report that will have expired by then', () => {
  const api = loadBlock(NOW);
  api.push({ ...liveReport });
  assert.equal(api.getModelOutput(1, new Date(NOW + 60 * 60 * 1000)).validReportCount, 0);
});

test('reports that expired by the real clock are still pruned', () => {
  const api = loadBlock(NOW);
  api.push({ ...liveReport, createdAt: NOW - 10 * 60 * 1000, expiresAt: NOW - 5 * 60 * 1000 });
  api.getModelOutput(1, new Date(NOW));
  assert.equal(api.count(), 0);
});
