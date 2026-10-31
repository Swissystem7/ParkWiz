// Wiring for the pilot-kit privacy lock (#281). The page must show the mode
// before the first sample frame, and the control must be the locked one from
// redact.js — not a second copy of the rule in the page.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const kit = fs.readFileSync(path.join(root, 'pilot-kit.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('the kit loads the redaction library and builds privacy mode from location', () => {
  assert.match(kit, /<script src="src\/lib\/redact\.js"><\/script>/);
  assert.match(kit, /const RED = window\.ParkWizRedact;/);
  assert.match(kit, /const privacy = RED\.createPrivacyMode\(window\.location\);/);
});

test('the toggle is visible, on by default, and names the Hebrew privacy state', () => {
  assert.match(kit, /id="btnPrivacy"[^>]*aria-pressed="true"/);
  assert.match(kit, /id="btnPrivacy"[^>]*>מצב פרטיות פועל</);
  assert.match(kit, /id="privBadge"/);
  assert.match(kit, /id="privLock"[^>]*hidden>נעול בבילד ייצור</);
  assert.match(kit, /aria-labelledby="privHead"/);
  assert.match(kit, /aria-describedby="privNote"/);
  assert.match(kit, /id="privHead">פרטיות</);
  assert.match(kit, /אין זיהוי לוחיות ואין זיהוי פנים/);
});

test('renderPrivacy disables the toggle when the lock is on, and runs before the first frame', () => {
  assert.match(kit, /btn\.disabled = privacy\.locked;/);
  assert.match(kit, /btn\.setAttribute\("aria-pressed", privacy\.enabled \? "true" : "false"\);/);
  assert.match(kit, /btn\.textContent = privacy\.labelHe\(\);/);
  assert.match(kit, /getElementById\("btnPrivacy"\)\.addEventListener\("click", \(\) => \{\s*privacy\.toggle\(\);\s*renderPrivacy\(\);/);
  const boot = kit.slice(kit.indexOf('(function restore()'));
  assert.ok(boot.indexOf('renderPrivacy()') < boot.indexOf('loadSample()'),
    'the privacy state is rendered before the first frame is loaded');
  assert.match(boot, /renderSpotList\(\);\s*drawChart\(state\.occupancy\);\s*loadSample\(\);/);
});

test('the privacy library is in the offline shell', () => {
  assert.match(sw, /'\.\/src\/lib\/redact\.js'/);
  assert.ok(Number(sw.match(/parkwiz-field-v(\d+)/)[1]) >= 27);
});
