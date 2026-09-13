const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('docs/CITY_DECISION.md exists with Netanya illustrative vs city X pending', () => {
  const p = path.join(ROOT, 'docs/CITY_DECISION.md');
  assert.ok(fs.existsSync(p), 'CITY_DECISION.md missing');
  const md = fs.readFileSync(p, 'utf8');
  assert.match(md, /Netanya/i);
  assert.match(md, /illustrative/i);
  assert.match(md, /city X|City X/i);
  assert.match(md, /pending|owner/i);
});
