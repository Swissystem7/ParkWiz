const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('CUT: the shared nav no longer sells a marketplace or a duplicate dashboard', () => {
  delete require.cache[require.resolve('../src/lib/surface-nav.js')];
  require('../src/lib/surface-nav.js');
  const ids = globalThis.ParkWizSurfaceNav.LINKS.map((l) => l.id);
  assert.ok(!ids.includes('market'), 'marketplace contradicts the municipal PIVOT');
  assert.ok(!ids.includes('dash'), 'dashboard duplicates the pilot report');
  for (const keep of ['map', 'brief', 'offer', 'kit', 'compare', 'report', 'privacy']) assert.ok(ids.includes(keep), keep);
  // the pages themselves stay (code is not deleted), only the message changes
  assert.ok(fs.existsSync(path.join(root, 'marketplace.html')));
  assert.ok(fs.existsSync(path.join(root, 'pilot-dashboard.html')));
});
