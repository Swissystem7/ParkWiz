const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { weightedAvailability, HALF_LIFE_MS } = require('../src/lib/availability');

const NOW = 1_000_000_000_000;
const ROOT = path.join(__dirname, '..');

test('validate=true accepts authorized fresh report', () => {
  const score = weightedAvailability([{ ts: NOW, delta: 1 }], NOW, true);
  assert.equal(score, 1);
});

test('validate=true accepts authorized decayed report', () => {
  const score = weightedAvailability([{ ts: NOW - HALF_LIFE_MS, delta: 2 }], NOW, true);
  assert.equal(score, 1);
});

test('validate=true RangeError on future timestamp', () => {
  assert.throws(
    () => weightedAvailability([{ ts: NOW + 1, delta: 1 }], NOW, true),
    (err) => err instanceof RangeError && /future/i.test(err.message)
  );
});

test('validate=true RangeError when any report is in the future', () => {
  const reports = [
    { ts: NOW - 1000, delta: 1 },
    { ts: NOW + 500, delta: -1 },
  ];
  assert.throws(() => weightedAvailability(reports, NOW, true), RangeError);
});

test('validate=true TypeError on non-array reports (null)', () => {
  assert.throws(() => weightedAvailability(null, NOW, true), TypeError);
});

test('validate=true TypeError on non-array reports (string)', () => {
  assert.throws(() => weightedAvailability('nope', NOW, true), TypeError);
});

test('demo_availability.sh prints authorized and unauthorized lines', () => {
  const script = path.join(ROOT, 'scripts', 'demo_availability.sh');
  assert.ok(fs.existsSync(script), 'scripts/demo_availability.sh must exist');
  const r = spawnSync('bash', [script], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /\[authorized\]/);
  assert.match(r.stdout, /\[unauthorized\].*RangeError/);
  assert.match(r.stdout, /\[unauthorized\].*TypeError/);
});

test('use_case_options.md lists municipal kit and synthetic eval harness', () => {
  const md = fs.readFileSync(path.join(ROOT, 'docs', 'use_case_options.md'), 'utf8');
  assert.match(md, /municipal occupancy kit/i);
  assert.match(md, /synthetic eval harness/i);
  assert.match(md, /decision pending/i);
});
