const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('docs/DPIA_CHECKLIST.md exists', () => {
  const p = path.join(ROOT, 'docs/DPIA_CHECKLIST.md');
  assert.ok(fs.existsSync(p), 'DPIA_CHECKLIST.md missing');
});

test('DPIA_CHECKLIST.md covers DPO, retention, camera vendor and notes ParkWiz-partb', () => {
  const md = read('docs/DPIA_CHECKLIST.md');
  assert.match(md, /DPO/i);
  assert.match(md, /retention/i);
  assert.match(md, /camera vendor/i);
  assert.match(md, /ParkWiz-partb/);
  assert.match(md, /DPIA-skeleton/);
  assert.match(md, /- \[ \]/);
});
