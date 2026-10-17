const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('pilot calibration page has empty states, accessible status regions, and a11y labels', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-calibrate.html'), 'utf8');

  // Empty state elements for spots
  assert.match(html, /id="spotsEmpty"[^>]*style="display:\s*block/);

  // Accessible live status element
  assert.match(html, /id="calStatus"[^>]*role="status"[^>]*aria-live="polite"/);

  // Accessible spot list and canvas
  assert.match(html, /id="spotList"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="calCanvas"[^>]*aria-label="[^"]+"/);

  // Accessible file inputs
  assert.match(html, /id="fileSnap"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="fileEmpty"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="fileNight"[^>]*aria-label="[^"]+"/);

  // Guard savePack when no spots are defined
  assert.match(html, /function savePack\(\)\s*\{[\s\S]*?if\s*\(!state\.spots\.length\)\s*\{[\s\S]*?setStatus\("אין מלבנים לשמירה/);

  // Guard computeEstimate when no snapshot or spots
  assert.match(html, /function computeEstimate\(\)\s*\{[\s\S]*?if\s*\(!state\.snap\s*\|\|\s*!state\.spots\.length\)\s*\{/);

  // Buttons disabled state when spots are empty
  assert.match(html, /btnUndo\.disabled\s*=\s*state\.spots\.length\s*===\s*0/);
  assert.match(html, /btnClear\.disabled\s*=\s*state\.spots\.length\s*===\s*0/);

  // Dynamic role listitem on spots
  assert.match(html, /row\.setAttribute\("role",\s*"listitem"\)/);
});
