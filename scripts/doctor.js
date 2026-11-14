'use strict';
// npm run doctor - run the local checks one after another and print one summary.
// Every step runs even if an earlier one fails; the exit code is 1 if any step failed.
const { spawnSync } = require('node:child_process');

const STEPS = ['test', 'knip', 'size', 'check:html', 'check:a11y-static'];

const results = [];
for (const step of STEPS) {
  console.log('\n=== doctor: npm run ' + step + ' ===');
  const started = Date.now();
  const r = spawnSync('npm', ['run', '--silent', step], { stdio: 'inherit', shell: process.platform === 'win32' });
  results.push({ step, ok: r.status === 0, seconds: ((Date.now() - started) / 1000).toFixed(1) });
}
console.log('\n=== doctor summary ===');
for (const r of results) console.log((r.ok ? 'ok    ' : 'FAIL  ') + r.step + ' (' + r.seconds + 's)');
if (results.some((r) => !r.ok)) process.exitCode = 1;
