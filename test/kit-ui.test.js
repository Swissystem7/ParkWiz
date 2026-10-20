const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('pilot kit page has empty states, accessible status regions, a11y labels, and button guards', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-kit.html'), 'utf8');

  // Accessible live status element
  assert.match(html, /id="kitStatus"[^>]*role="status"[^>]*aria-live="polite"/);

  // Empty state elements for spot list and chart
  assert.match(html, /<p class="empty-msg" id="spotListEmpty"[^>]*style="display:none"/);
  assert.match(html, /<p class="empty-msg" id="chartEmpty"[^>]*style="display:none"/);

  // Accessible form controls, stage, canvas, and regions
  assert.match(html, /id="stage"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="calCanvas"[^>]*role="img"[^>]*aria-label="[^"]+"/);
  assert.match(html, /class="kpis"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="chart"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="spotList"[^>]*role="region"[^>]*aria-label="[^"]+"/);

  // Dynamic a11y attributes on generated spot items
  assert.match(html, /row\.setAttribute\("role",\s*"listitem"\)/);
  assert.match(html, /row\.setAttribute\("aria-label",\s*"מקום "\s*\+\s*\(i\s*\+\s*1\)\s*\+\s*": "\s*\+\s*statusText\)/);

  // Guards against exporting or modifying when empty
  assert.match(html, /getElementById\("btnExportOcc"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!state\.occupancy\.length\)\s*\{\s*setStatus\("אין נתוני תפוסה לייצוא\.",\s*true\);\s*return;\s*\}/);
  assert.match(html, /getElementById\("btnExportCsv"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!state\.occupancy\.length\)\s*\{\s*setStatus\("אין נתוני תפוסה לייצוא\.",\s*true\);\s*return;\s*\}/);
  assert.match(html, /getElementById\("btnExportSpots"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!state\.spots\.length\)\s*\{\s*setStatus\("אין מלבנים לייצוא\.",\s*true\);\s*return;\s*\}/);
  assert.match(html, /getElementById\("btnUndo"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!state\.spots\.length\)\s*\{\s*setStatus\("אין מלבנים לביטול\.",\s*true\);\s*return;\s*\}/);
  assert.match(html, /getElementById\("btnClear"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!state\.spots\.length\)\s*\{\s*setStatus\("אין מלבנים לניקוי\.",\s*true\);\s*return;\s*\}/);

  // renderSpotList and drawChart handle empty states
  assert.match(html, /if\s*\(!state\.spots\.length\)\s*\{[\s\S]*?if\s*\(emptyEl\)\s*emptyEl\.style\.display\s*=\s*"block";/);
  assert.match(html, /if\s*\(!recs\s*\|\|\s*!recs\.length\)\s*\{[\s\S]*?if\s*\(emptyEl\)\s*emptyEl\.style\.display\s*=\s*"block";/);
});

test('pilot kit page has a copy summary action, announced estimate note, and guarded imports', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-kit.html'), 'utf8');

  // The estimate note is announced, not just rendered
  assert.match(html, /id="estNote"[^>]*role="status"[^>]*aria-live="polite"/);

  // Every file picker carries its own label for screen readers
  assert.match(html, /id="fileSnap"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="fileEmpty"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="fileNight"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="fileSpots"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="fileOcc"[^>]*aria-label="[^"]+"/);

  // Copy summary button exists, is wired, and uses the clipboard
  assert.match(html, /<button type="button" id="btnCopySummary"[^>]*>/);
  assert.match(html, /document\.getElementById\("btnCopySummary"\)\.addEventListener\("click",/);
  assert.match(html, /navigator\.clipboard\.writeText/);

  // Copy is guarded when nothing is marked, and reports both outcomes
  assert.match(html, /document\.getElementById\("btnCopySummary"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{\s*if\s*\(!state\.spots\.length\)\s*\{\s*setStatus\("אין מלבנים להעתקה\.",\s*true\);\s*return;\s*\}/);
  assert.match(html, /setStatus\("תקציר התפוסה הועתק ללוח\."\)/);
  assert.match(html, /setStatus\("העתקה ללוח לא הצליחה בדפדפן זה\.",\s*true\)/);

  // Outside a secure context (file://, LAN http://) there is no
  // navigator.clipboard: the copy falls back to execCommand instead of giving
  // up, and a rejected writeText takes the same fallback.
  assert.doesNotMatch(html, /העתקה ללוח אינה נתמכת/);
  assert.match(html, /const fallbackCopy = \(\) => \{[\s\S]*?document\.createElement\("textarea"\)[\s\S]*?ok = document\.execCommand\("copy"\)[\s\S]*?document\.body\.removeChild\(ta\);/);
  assert.match(html, /navigator\.clipboard\.writeText\(summaryText\)\.then\([\s\S]*?\}\)\.catch\(fallbackCopy\);\s*\}\s*else\s*\{\s*fallbackCopy\(\);\s*\}/);

  // The summary names the street and the heuristic method
  assert.match(html, /"רחוב\/אתר: "\s*\+\s*street\(\)/);
  assert.match(html, /HEU\.methodLabelHe\(state\.estimates\[0\]\.method\)/);

  // A malformed import reports an error instead of throwing past the handler
  assert.match(html, /getElementById\("fileSpots"\)\.addEventListener\("change",[\s\S]*?try\s*\{[\s\S]*?\}\s*catch\s*\(err\)\s*\{\s*setStatus\("שגיאה בקריאת spots\.json\.",\s*true\);/);
  assert.match(html, /getElementById\("fileOcc"\)\.addEventListener\("change",[\s\S]*?try\s*\{[\s\S]*?\}\s*catch\s*\(err\)\s*\{\s*setStatus\("שגיאה בטעינת occupancy\.json\.",\s*true\);/);

  // Restored occupancy is charted on boot, not only after a fresh estimate
  assert.match(html, /renderSpotList\(\);\s*drawChart\(state\.occupancy\);\s*loadSample\(\);/);
});

test('pilot kit panels are labelled landmarks and every action button names itself', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-kit.html'), 'utf8');

  // Each workflow panel is a region labelled by its own heading
  for (const id of ['secSnap', 'secEst', 'secChart', 'secSpots']) {
    assert.match(html, new RegExp(`<section class="panel"[^>]*role="region"[^>]*aria-labelledby="${id}"`));
    assert.match(html, new RegExp(`<h2 id="${id}">`));
  }

  // Terse button texts get a fuller accessible name, and WCAG 2.5.3 holds:
  // the visible text stays inside the accessible name, so voice control can
  // still say what it reads on screen.
  for (const id of [
    'btnSample', 'btnEstimate', 'btnCopySummary', 'btnExportOcc', 'btnExportCsv',
    'btnLoadSampleOcc', 'btnUndo', 'btnClear', 'btnSaveLs', 'btnExportSpots',
  ]) {
    const btn = html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>([^<]*)</button>`));
    assert.ok(btn, `${id} must be a button with visible text`);
    const label = (btn[0].match(/aria-label="([^"]+)"/) || [])[1];
    assert.ok(label, `${id} needs an aria-label`);
    assert.ok(
      label.includes(btn[1].trim()),
      `${id} aria-label "${label}" must contain its visible text "${btn[1].trim()}" (WCAG 2.5.3)`
    );
  }

  // Clearing the spots resets the KPI counters instead of leaving stale numbers
  assert.match(
    html,
    /getElementById\("btnClear"\)\.addEventListener\("click",[\s\S]*?getElementById\("kTotal"\)\.textContent\s*=\s*"0";\s*document\.getElementById\("kOcc"\)\.textContent\s*=\s*"0";\s*document\.getElementById\("kFree"\)\.textContent\s*=\s*"0";/
  );

  // The copied summary says the numbers are heuristic, not AI or a live camera
  assert.match(html, /"הערה: הערכה היוריסטית על snapshot — לא בינה מלאכותית ולא מצלמה חיה\."/);
});
