const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-calibrate.html'), 'utf8');

test('pilot calibration page has empty states, accessible status regions, and a11y labels', () => {
  // Empty state element for the spot list. One paragraph only: #249 called it
  // spotListEmpty, master landed it as spotsEmpty, and two empty-state notes in
  // the same panel would contradict each other.
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

test('pilot calibrate page has copy/reset actions, landmark regions, and labelled controls', () => {
  // estNote and emptyNote are visible notes. The only polite status region is
  // #calStatus, after the wizard panels, so copy, reset and save stay announced
  // when renderSteps() returns to step 1 and hides panel 4.
  assert.match(html, /<p class="hint" id="estNote">/);
  assert.match(html, /<p class="hint" id="emptyNote">/);
  assert.doesNotMatch(html, /id="estNote"[^>]*aria-live/);
  assert.doesNotMatch(html, /id="emptyNote"[^>]*aria-live/);
  assert.match(html, /id="panel-check"[\s\S]*?<\/section>\s*<div id="calStatus" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(html, /id="timer"[^>]*role="timer"[^>]*aria-live="polite"/);

  // Regions, stage, canvas, and panels
  assert.match(html, /id="stage"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="calCanvas"[^>]*role="img"[^>]*aria-label="[^"]+"/);
  assert.match(html, /class="kpis"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="stepList"[^>]*role="list"[^>]*aria-label="[^"]+"/);
  assert.match(html, /<section class="panel"[^>]*id="panel-image"[^>]*role="region"[^>]*aria-labelledby="hImage"/);
  assert.match(html, /<section class="panel hidden"[^>]*id="panel-spots"[^>]*role="region"[^>]*aria-labelledby="hSpots"/);
  assert.match(html, /<section class="panel hidden"[^>]*id="panel-empty"[^>]*role="region"[^>]*aria-labelledby="hEmpty"/);
  assert.match(html, /<section class="panel hidden"[^>]*id="panel-check"[^>]*role="region"[^>]*aria-labelledby="hCheck"/);

  // Every wizard control carries an accessible name
  for (const id of [
    'btnStart', 'btnDemo', 'streetName', 'btnSampleSnap', 'btnSampleSpots',
    'btnUndo', 'btnClear', 'btnSampleEmpty', 'btnSampleNight', 'btnEstimate',
    'btnCopySummary', 'btnSave', 'btnReset', 'btnPrev', 'btnNext',
  ]) {
    assert.match(html, new RegExp(`id="${id}"[^>]*aria-label="[^"]+"`), `${id} needs an aria-label`);
  }

  // Generated spot rows announce their own occupancy status
  assert.match(html, /row\.setAttribute\("aria-label",\s*"מקום "\s*\+\s*\(i\s*\+\s*1\)\s*\+\s*": "\s*\+\s*statusText\)/);

  // Guards explain the blocked action instead of failing silently. savePack and
  // computeEstimate also write to calStatus, so the note assignment is matched
  // anywhere inside the guard rather than as its only statement.
  assert.match(html, /getElementById\("btnUndo"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!state\.spots\.length\)\s*\{\s*document\.getElementById\("estNote"\)\.textContent\s*=\s*"אין מלבנים לביטול\.";\s*return;\s*\}/);
  assert.match(html, /getElementById\("btnClear"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!state\.spots\.length\)\s*\{\s*document\.getElementById\("estNote"\)\.textContent\s*=\s*"אין מלבנים לניקוי\.";\s*return;\s*\}/);
  assert.match(html, /function computeEstimate\(\)\s*\{[\s\S]*?if\s*\(!state\.snap\s*\|\|\s*!state\.spots\.length\)\s*\{[\s\S]*?"חסרים תמונה או מלבנים לחישוב תפוסה\.";/);
  assert.match(html, /function savePack\(\)\s*\{[\s\S]*?if\s*\(!state\.spots\.length\)\s*\{[\s\S]*?document\.getElementById\("estNote"\)\.textContent\s*=\s*"אין מלבנים שמורים לשמירת כיול\.";/);

  // Copy summary action. An empty summary is announced on #calStatus.
  assert.match(html, /function buildSummaryText\(\)\s*\{\s*if\s*\(!state\.spots\.length\)\s*return\s*"";/);
  assert.match(html, /async function copySummary\(\)\s*\{[\s\S]*?if\s*\(!text\)\s*\{\s*setStatus\("אין נתוני כיול להעתקה\.",\s*true\);\s*return;\s*\}/);
  assert.match(html, /document\.getElementById\("btnCopySummary"\)\.addEventListener\("click",\s*copySummary\)/);

  // Reset action
  assert.match(html, /function resetCalibrate\(\)\s*\{[\s\S]*?state\.spots\s*=\s*\[\];/);
  assert.match(html, /document\.getElementById\("btnReset"\)\.addEventListener\("click",\s*resetCalibrate\)/);
});

test('reset clears the calibration clock and announces on the live status', () => {
  const body = html.match(/function resetCalibrate\(\)\s*\{[\s\S]*?\n\}/)[0];
  assert.match(body, /clearInterval\(state\.tick\)/);
  assert.match(body, /state\.startedAt\s*=\s*null/);
  assert.match(body, /state\.lastLot\s*=\s*null/);
  // #calStatus stays on screen at every step, so the confirmation replaces any
  // stale line there instead of a note inside the hidden check panel.
  assert.match(body, /setStatus\("הכיול אופס בהצלחה\."\)/);
  assert.match(body, /timerNote"\)\.textContent\s*=\s*"השעון מתחיל בלחיצה על «התחל כיול»\. היעד הוא 3 דקות, לא SLA\."/);
  // src="" resolves to the document URL and requests the page as an image.
  assert.doesNotMatch(body, /snapImg\.src\s*=\s*""/);
  assert.match(body, /snapImg\.removeAttribute\("src"\)/);
});
