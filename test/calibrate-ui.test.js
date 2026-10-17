const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('pilot calibrate page has accessible status regions, empty states, copy/reset actions, and guards', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-calibrate.html'), 'utf8');

  // Accessible live status and timer elements
  assert.match(html, /id="estNote"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="emptyNote"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="timer"[^>]*role="timer"[^>]*aria-live="polite"/);

  // Empty state element for spot list
  assert.match(html, /id="spotListEmpty"/);

  // Accessible regions, stage, canvas, and panels
  assert.match(html, /id="stage"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="calCanvas"[^>]*role="img"[^>]*aria-label="[^"]+"/);
  assert.match(html, /class="kpis"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="spotList"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="stepList"[^>]*role="list"[^>]*aria-label="[^"]+"/);
  assert.match(html, /<section class="panel"[^>]*id="panel-image"[^>]*role="region"[^>]*aria-labelledby="hImage"/);
  assert.match(html, /<section class="panel hidden"[^>]*id="panel-spots"[^>]*role="region"[^>]*aria-labelledby="hSpots"/);
  assert.match(html, /<section class="panel hidden"[^>]*id="panel-empty"[^>]*role="region"[^>]*aria-labelledby="hEmpty"/);
  assert.match(html, /<section class="panel hidden"[^>]*id="panel-check"[^>]*role="region"[^>]*aria-labelledby="hCheck"/);

  // Accessible attributes on form controls and action buttons
  assert.match(html, /id="btnStart"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnDemo"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="streetName"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnSampleSnap"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="fileSnap"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnSampleSpots"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnUndo"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnClear"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnSampleEmpty"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnSampleNight"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="fileEmpty"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="fileNight"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnEstimate"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnCopySummary"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnSave"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnReset"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnPrev"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnNext"[^>]*aria-label="[^"]+"/);

  // Dynamic a11y attributes on generated spot items
  assert.match(html, /row\.setAttribute\("role",\s*"listitem"\)/);
  assert.match(html, /row\.setAttribute\("aria-label",\s*"מקום "\s*\+\s*\(i\s*\+\s*1\)\s*\+\s*": "\s*\+\s*statusText\)/);

  // Guards against operations when spots are empty
  assert.match(html, /getElementById\("btnUndo"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!state\.spots\.length\)\s*\{\s*document\.getElementById\("estNote"\)\.textContent\s*=\s*"אין מלבנים לביטול\.";\s*return;\s*\}/);
  assert.match(html, /getElementById\("btnClear"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!state\.spots\.length\)\s*\{\s*document\.getElementById\("estNote"\)\.textContent\s*=\s*"אין מלבנים לניקוי\.";\s*return;\s*\}/);
  assert.match(html, /function computeEstimate\(\)\s*\{[\s\S]*?if\s*\(!state\.snap \|\| !state\.spots\.length\)\s*\{\s*document\.getElementById\("estNote"\)\.textContent\s*=\s*"חסרים תמונה או מלבנים לחישוב תפוסה\.";\s*return;\s*\}/);
  assert.match(html, /function savePack\(\)\s*\{[\s\S]*?if\s*\(!state\.spots\.length\)\s*\{\s*document\.getElementById\("estNote"\)\.textContent\s*=\s*"אין מלבנים שמורים לשמירת כיול\.";\s*return;\s*\}/);

  // Copy summary function implementation and listener
  assert.match(html, /(?:async\s+)?function copySummary\(\)\s*\{[\s\S]*?if\s*\(!state\.spots\.length\)\s*\{[\s\S]*?"אין נתוני כיול להעתקה\.";\s*return;\s*\}/);
  assert.match(html, /document\.getElementById\("btnCopySummary"\)\.addEventListener\("click",\s*copySummary\)/);

  // Reset function implementation and listener
  assert.match(html, /function resetCalibrate\(\)\s*\{[\s\S]*?state\.spots\s*=\s*\[\];/);
  assert.match(html, /document\.getElementById\("btnReset"\)\.addEventListener\("click",\s*resetCalibrate\)/);
});
