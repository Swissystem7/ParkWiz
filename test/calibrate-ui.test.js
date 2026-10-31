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
  // Live status and timer elements. estNote and emptyNote announce the inline
  // result; calStatus (asserted above) announces per-action feedback.
  assert.match(html, /id="estNote"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="emptyNote"[^>]*role="status"[^>]*aria-live="polite"/);
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

  // Copy summary action
  assert.match(html, /(?:async\s+)?function copySummary\(\)\s*\{[\s\S]*?if\s*\(!state\.spots\.length\)\s*\{[\s\S]*?"אין נתוני כיול להעתקה\.";\s*return;\s*\}/);
  assert.match(html, /document\.getElementById\("btnCopySummary"\)\.addEventListener\("click",\s*copySummary\)/);
  // file:// and LAN http:// have no clipboard API. A rejected writeText takes
  // the same hidden-textarea fallback, and a failed fallback is not reported as success.
  assert.match(html, /function copyTextFallback\(text\)/);
  assert.match(html, /document\.execCommand\("copy"\)/);
  assert.match(html, /await navigator\.clipboard\.writeText\(lines\)/);
  assert.match(html, /if \(!copied\) \{\s*try \{ copied = copyTextFallback\(lines\); \} catch \(e\) \{ copied = false; \}\s*\}/);
  assert.match(html, /note\.textContent = copied \? "סיכום הכיול הועתק ללוח\." : "לא ניתן להעתיק ללוח בדפדפן זה\."/);

  // Reset action
  assert.match(html, /function resetCalibrate\(\)\s*\{[\s\S]*?state\.spots\s*=\s*\[\];/);
  assert.match(html, /document\.getElementById\("btnReset"\)\.addEventListener\("click",\s*resetCalibrate\)/);
});

test('copy and reset start disabled until the wizard has something to copy or clear', () => {
  assert.match(html, /id="btnCopySummary"[^>]*disabled/);
  assert.match(html, /id="btnReset"[^>]*disabled/);
  assert.match(html, /button:disabled\{opacity:\.45;cursor:not-allowed\}/);
  assert.match(html, /function wizardHasWork\(\)/);
  assert.match(html, /copyBtn\.disabled = state\.spots\.length === 0/);
  assert.match(html, /resetBtn\.disabled = !wizardHasWork\(\)/);
  assert.match(html, /function resetCalibrate\(\)\s*\{\s*if \(!wizardHasWork\(\)\) return;/);
  assert.match(html, /tickClock\(\);\s*refreshActionButtons\(\);/);
  const work = html.match(/function wizardHasWork\(\)\s*\{[\s\S]*?\n\}/)[0];
  assert.match(work, /hasStoredCalibration\(\)/);
  const stored = html.match(/function hasStoredCalibration\(\)\s*\{[\s\S]*?\n\}/)[0];
  assert.match(stored, /OCC\.LS\.calibration/);
  assert.match(stored, /OCC\.LS\.spots/);
  assert.match(stored, /OCC\.LS\.estimate/);
  assert.match(stored, /OCC\.LS\.street/);
});

test('calStatus is an atomic live region outside the wizard panels', () => {
  assert.match(html, /id="calStatus"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.match(html, /id="estNote"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="emptyNote"[^>]*role="status"[^>]*aria-live="polite"/);
  const panel = html.indexOf('id="panel-check"');
  const panelEnd = html.indexOf('</section>', panel);
  assert.ok(html.indexOf('id="calStatus"') > panelEnd, 'calStatus stays visible when a panel is hidden');
  const save = html.match(/function savePack\(\)\s*\{[\s\S]*?\n\}/)[0];
  assert.match(save, /setStatus\("כיול נשמר \(השעון לא הופעל/);
  assert.match(save, /setStatus\(\s*\(CAL\.underTarget\(elapsed\) \? "כיול נשמר תוך " : "כיול נשמר אחרי "\)/);
  assert.doesNotMatch(save, /note\.textContent\s*=\s*"כיול נשמר/);
  assert.doesNotMatch(save, /setStatus\(note\.textContent\)/);
});

test('reset clears the calibration clock and the stale status line', () => {
  const body = html.match(/function resetCalibrate\(\)\s*\{[\s\S]*?\n\}/)[0];
  assert.match(body, /clearInterval\(state\.tick\)/);
  assert.match(body, /state\.startedAt\s*=\s*null/);
  assert.match(body, /state\.lastLot\s*=\s*null/);
  // A status line written before the reset describes state that no longer exists.
  assert.match(body, /setStatus\(""\)/);
  // The confirmation has to be visible after renderSteps() returns to step 1,
  // which hides the panel that owns estNote.
  assert.match(body, /timerNote"\)\.textContent\s*=\s*"הכיול אופס\./);
  // src="" resolves to the document URL and requests the page as an image.
  assert.doesNotMatch(body, /snapImg\.src\s*=\s*""/);
  assert.match(body, /snapImg\.removeAttribute\("src"\)/);
  assert.match(body, /localStorage\.removeItem\(OCC\.LS\.calibration\)/);
  assert.match(body, /localStorage\.removeItem\(OCC\.LS\.spots\)/);
  assert.match(body, /localStorage\.removeItem\(OCC\.LS\.estimate\)/);
  assert.match(body, /localStorage\.removeItem\(OCC\.LS\.street\)/);
  assert.match(body, /\["fileSnap", "fileEmpty", "fileNight"\]/);
});
