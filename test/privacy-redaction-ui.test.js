// The wiring tests for issue #281. The redaction algorithm is covered in
// test/redact*.test.js; what matters here is that pilot-kit.html — the only
// surface in the repo that reads camera frames — cannot display, measure or
// export a frame that has not been through the gate, and that the operator can
// see the privacy state.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const kit = read('pilot-kit.html');

test('the kit page loads the redaction library and builds its privacy mode from location', () => {
  assert.match(kit, /<script src="src\/lib\/redact\.js"><\/script>/);
  assert.match(kit, /const RED = window\.ParkWizRedact;/);
  assert.match(kit, /const privacy = RED\.createPrivacyMode\(window\.location\);/);
  // The redaction surface must never be in the document, or there would be an
  // instant where a raw frame is on screen.
  assert.match(kit, /const redactStage = document\.createElement\("canvas"\);/);
  assert.doesNotMatch(kit, /appendChild\(redactStage\)/);
});

test('every frame source goes through ingestFrame, and nothing else loads a frame', () => {
  assert.match(kit, /async function ingestFrame\(rawUrl\)/);
  assert.match(kit, /RED\.redactSource\(raw, redactStage\)/);

  // loadImage is the raw loader. After the gate landed, the only caller allowed
  // to use it directly is ingestFrame itself (twice: the raw frame and the
  // redacted copy). Any other call site would be a frame that skipped the gate.
  const callers = [...kit.matchAll(/await loadImage\(/g)].length;
  assert.equal(callers, 2, 'only ingestFrame may call loadImage');

  // The three file inputs and the two sample loaders all route through it.
  assert.equal([...kit.matchAll(/await ingestFrame\(/g)].length, 6);
  for (const input of ['fileSnap', 'fileEmpty', 'fileNight']) {
    const handler = kit.slice(kit.indexOf('"' + input + '").addEventListener'));
    assert.match(handler.slice(0, 400), /ingestFrame\(await fileToDataUrl\(f\)/,
      input + ' redacts the chosen file before anything else sees it');
  }
});

test('what is displayed is the redacted copy, never the raw object URL', () => {
  // The old code did `snapImg.src = snapUrl` / `= url` with the raw blob.
  assert.doesNotMatch(kit, /snapImg\.src = snapUrl/);
  assert.doesNotMatch(kit, /snapImg\.src = url/);
  assert.match(kit, /snapImg\.src = state\.snap\.src/);
  assert.match(kit, /snapImg\.src = snap\.image\.src/);
});

test('the raw frame is revoked as soon as the redacted copy exists', () => {
  const gate = kit.slice(kit.indexOf('async function ingestFrame'), kit.indexOf('function renderPrivacy'));
  assert.match(gate, /URL\.revokeObjectURL\(rawUrl\)/);
  // Fail closed: a browser that cannot hand back a redacted copy gets no frame
  // at all, rather than the raw one.
  assert.match(gate, /catch \(err\)[\s\S]*?throw new Error\("redaction-unavailable"\)/);
  // The one path that returns the raw image sits behind the dev-only toggle,
  // which createPrivacyMode refuses to switch off in production.
  assert.match(gate, /if \(!privacy\.enabled\) \{[\s\S]*?return \{ image: raw, report: null \};/);
  assert.match(kit, /הפריים לא הוצג: לא ניתן להפיק עותק מטושטש/);
});

test('the toggle is visible, on by default, and shows Hebrew privacy state', () => {
  assert.match(kit, /id="btnPrivacy"[^>]*aria-pressed="true"/);
  assert.match(kit, /מצב פרטיות פועל/);
  assert.match(kit, /id="privBadge"/);
  assert.match(kit, /id="privLock"[^>]*hidden>נעול בבילד ייצור/);
  assert.match(kit, /id="privCount"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(kit, /aria-labelledby="privHead"/);
  assert.match(kit, /aria-describedby="privNote"/);
});

test('renderPrivacy disables the toggle in production and runs before the first frame', () => {
  assert.match(kit, /btn\.disabled = privacy\.locked;/);
  assert.match(kit, /btn\.setAttribute\("aria-pressed", privacy\.enabled \? "true" : "false"\);/);
  // Boot order: the state is on screen before loadSample() fetches anything.
  const boot = kit.slice(kit.indexOf('(function restore()'));
  assert.ok(boot.indexOf('renderPrivacy()') < boot.indexOf('loadSample()'),
    'the privacy state is rendered before the first frame is loaded');
});

test('the privacy demo frame is reachable from the UI and is part of the offline shell', () => {
  assert.match(kit, /id="btnSamplePrivacy"/);
  assert.match(kit, /loadSample\("privacy"\)/);
  assert.match(kit, /sample-lot-privacy\.svg/);
  const sw = read('sw.js');
  assert.match(sw, /'\.\/pilot\/sample-lot-privacy\.svg'/);
  assert.match(sw, /'\.\/src\/lib\/redact\.js'/);
  // Cache-first shell: a new asset list needs a new cache name or the operator
  // keeps the old page.
  assert.ok(Number(sw.match(/parkwiz-field-v(\d+)/)[1]) >= 19);
});

test('no image ever reaches localStorage or an export from the kit page', () => {
  // Everything written to storage is a JSON document of numbers; the four keys
  // are spots / street / occupancy / estimates.
  const writes = [...kit.matchAll(/localStorage\.setItem\(([^,]+),/g)].map((m) => m[1].trim());
  assert.deepEqual(writes, ['LS_SPOTS', 'LS_STREET', 'LS_EST']);
  assert.doesNotMatch(kit, /localStorage\.setItem\([^)]*toDataURL/);
  assert.doesNotMatch(kit, /localStorage\.setItem\([^)]*snapImg/);
  // The only toDataURL calls are the synthetic fallback frame and the redacted
  // copy itself — no "export this snapshot" path exists to leak a raw frame.
  const exports = [...kit.matchAll(/toDataURL\(/g)].length;
  assert.equal(exports, 2);
  assert.match(kit, /redactedUrl = redactStage\.toDataURL\("image\/png"\)/);
});

test('the privacy doc exists in Hebrew and English and states the four commitments', () => {
  const doc = read('docs/privacy-redaction.md');
  assert.match(doc, /## עברית/);
  assert.match(doc, /## English/);
  // The claims the lawyer and the park are being asked to rely on.
  assert.match(doc, /הכול במכשיר/);
  assert.match(doc, /אין זיהוי/);
  assert.match(doc, /אין פריים גולמי שנשמר/);
  assert.match(doc, /Fully on-device/);
  assert.match(doc, /No recognition/);
  assert.match(doc, /No raw frame is retained/);
  // The legal hooks and the honest limits.
  assert.match(doc, /חוק הגנת הפרטיות/);
  assert.match(doc, /12825-12-24/);
  assert.match(doc, /white\/foreign plates are deliberately not a class|White \(EU-format\) plates are not detected/);
  assert.match(doc, /נעול בבילד ייצור|locked in production/);
  assert.match(doc, /src\/lib\/redact\.js/);
});
