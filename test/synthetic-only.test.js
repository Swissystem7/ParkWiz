const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('docs/SYNTHETIC_ONLY.md exists with fieldMeasured false', () => {
  const p = path.join(ROOT, 'docs/SYNTHETIC_ONLY.md');
  assert.ok(fs.existsSync(p), 'docs/SYNTHETIC_ONLY.md missing');
  const md = fs.readFileSync(p, 'utf8');
  assert.match(md, /fieldMeasured:\s*false|`fieldMeasured:\s*false`|\*\*`fieldMeasured:\s*false`\*\*/);
  assert.match(md, /synthetic/i);
  assert.match(md, /fieldMeasured/);
});

test('SYNTHETIC_ONLY.md forbids marketing demo as field-proven', () => {
  const md = fs.readFileSync(path.join(ROOT, 'docs/SYNTHETIC_ONLY.md'), 'utf8');
  assert.match(md, /field-proven|field study|measured/i);
  assert.match(md, /Do not|do not|Not done/i);
});
