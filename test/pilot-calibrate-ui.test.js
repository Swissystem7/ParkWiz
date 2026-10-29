const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-calibrate.html'), 'utf8');

test('exactly one role="status" aria-live="polite" element exists and it is #calStatus', () => {
  const statusMatches = html.match(/role="status"/g) || [];
  assert.equal(statusMatches.length, 1);
  const politeStatus = html.match(/<[^>]*role="status"[^>]*aria-live="polite"[^>]*>/g) || [];
  assert.equal(politeStatus.length, 1);
  assert.match(html, /id="calStatus"[^>]*role="status"[^>]*aria-live="polite"/);
});

test('"העתק סיכום" button exists with id btnCopySummary and starts disabled', () => {
  assert.match(html, /<button[^>]*id="btnCopySummary"[^>]*disabled[^>]*>העתק סיכום<\/button>/);
});

test('"אפס כיול" button exists with id btnReset and starts disabled', () => {
  assert.match(html, /<button[^>]*id="btnReset"[^>]*disabled[^>]*>אפס כיול<\/button>/);
});

test('copy wiring uses clipboard API with execCommand fallback', () => {
  assert.match(html, /getElementById\("btnCopySummary"\)\.addEventListener\("click", copySummary\)/);
  assert.match(html, /async function copySummary\(\)/);
  assert.match(html, /function buildSummaryText\(\)/);
  assert.match(html, /navigator\.clipboard\.writeText\(text\)/);
  assert.match(html, /function copyTextFallback\(text\)/);
  assert.match(html, /document\.execCommand\("copy"\)/);
  assert.match(html, /copyTextFallback\(text\)/);
});

test('reset wiring clears localStorage keys and resets state', () => {
  assert.match(html, /getElementById\("btnReset"\)\.addEventListener\("click", resetCalibrate\)/);
  assert.match(html, /function resetCalibrate\(\)/);
  const body = html.match(/function resetCalibrate\(\)\s*\{[\s\S]*?\n\}/)[0];
  assert.match(body, /localStorage\.removeItem\(OCC\.LS\.calibration\)/);
  assert.match(body, /localStorage\.removeItem\(OCC\.LS\.spots\)/);
  assert.match(body, /localStorage\.removeItem\(OCC\.LS\.estimate\)/);
  assert.match(body, /state\.spots = \[\]/);
  assert.match(body, /state\.estimates = \[\]/);
  assert.match(body, /state\.lastLot = null/);
});

test('copy stays disabled without spots; reset stays disabled without session or stored data', () => {
  assert.match(html, /function hasCalibrationData\(\)/);
  assert.match(html, /state\.startedAt \|\| state\.step \|\| state\.spots\.length/);
  assert.match(html, /copyBtn\.disabled = state\.spots\.length === 0/);
  assert.match(html, /resetBtn\.disabled = !hasCalibrationData\(\)/);
  assert.match(html, /tickClock\(\);\s*refreshActionButtons\(\);/);
  assert.match(html, /renderSteps\(\);\s*renderSpotList\(\);\s*refreshActionButtons\(\);/);
});

test('a saved pack is announced on #calStatus', () => {
  const body = html.match(/function savePack\(\)\s*\{[\s\S]*?\n\}/)[0];
  assert.match(body, /setStatus\(note\.textContent\)/);
  assert.doesNotMatch(body, /setStatus\(""\)/);
});
