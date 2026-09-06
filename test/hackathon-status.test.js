const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('docs/HACKATHON_STATUS.md exists with 31.8.2026 PASSED and archive under docs/', () => {
  const p = path.join(ROOT, 'docs/HACKATHON_STATUS.md');
  assert.ok(fs.existsSync(p), 'docs/HACKATHON_STATUS.md missing');
  const md = fs.readFileSync(p, 'utf8');
  assert.match(md, /31\.8\.2026|31\.08\.2026|2026-08-31/);
  assert.match(md, /PASSED/i);
  assert.match(md, /docs\/archive|archive under docs/i);
});
