const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('pilot kit page has accessible status regions, empty states, copy action, and guards', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-kit.html'), 'utf8');

  // Accessible live status element
  assert.match(html, /id="estNote"[^>]*role="status"[^>]*aria-live="polite"/);

  // Empty state elements for spot list and chart
  assert.match(html, /id="spotListEmpty"/);
  assert.match(html, /id="chartEmpty"/);

  // Accessible regions, stage, canvas, and panels
  assert.match(html, /id="stage"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="calCanvas"[^>]*role="img"[^>]*aria-label="[^"]+"/);
  assert.match(html, /class="kpis"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="chart"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="spotList"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /<section class="panel"[^>]*role="region"[^>]*aria-labelledby="secSnap"/);
  assert.match(html, /<section class="panel"[^>]*role="region"[^>]*aria-labelledby="secEst"/);
  assert.match(html, /<section class="panel"[^>]*role="region"[^>]*aria-labelledby="secChart"/);
  assert.match(html, /<section class="panel"[^>]*role="region"[^>]*aria-labelledby="secSpots"/);

  // Accessible attributes on form controls and action buttons
  assert.match(html, /id="btnSample"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="fileSnap"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="fileEmpty"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="fileNight"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="streetName"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnEstimate"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnCopySummary"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnExportOcc"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnExportCsv"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnUndo"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnClear"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnSaveLs"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnExportSpots"[^>]*aria-label="[^"]+"/);

  // Dynamic a11y attributes on generated spot items
  assert.match(html, /row\.setAttribute\("role",\s*"listitem"\)/);
  assert.match(html, /row\.setAttribute\("aria-label",\s*"מקום "\s*\+\s*\(i\s*\+\s*1\)\s*\+\s*": "\s*\+\s*statusText\)/);

  // Guards against exporting or modifying when empty
  assert.match(html, /getElementById\("btnExportOcc"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!state\.occupancy\.length\)\s*\{\s*document\.getElementById\("estNote"\)\.textContent\s*=\s*"אין נתוני תפוסה לייצוא\.";\s*return;\s*\}/);
  assert.match(html, /getElementById\("btnExportCsv"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!state\.occupancy\.length\)\s*\{\s*document\.getElementById\("estNote"\)\.textContent\s*=\s*"אין נתוני תפוסה לייצוא\.";\s*return;\s*\}/);
  assert.match(html, /getElementById\("btnExportSpots"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!state\.spots\.length\)\s*\{\s*document\.getElementById\("estNote"\)\.textContent\s*=\s*"אין מלבנים לייצוא\.";\s*return;\s*\}/);
  assert.match(html, /getElementById\("btnUndo"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!state\.spots\.length\)\s*\{\s*document\.getElementById\("estNote"\)\.textContent\s*=\s*"אין מלבנים לביטול\.";\s*return;\s*\}/);
  assert.match(html, /getElementById\("btnClear"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!state\.spots\.length\)\s*\{\s*document\.getElementById\("estNote"\)\.textContent\s*=\s*"אין מלבנים לניקוי\.";\s*return;\s*\}/);

  // Copy summary function implementation
  assert.match(html, /function copySummary\(\)\s*\{[\s\S]*?if\s*\(!state\.spots\.length && !state\.occupancy\.length\)\s*\{\s*document\.getElementById\("estNote"\)\.textContent\s*=\s*"אין נתוני תפוסה להעתקה\.";\s*return;\s*\}/);
  assert.match(html, /document\.getElementById\("btnCopySummary"\)\.addEventListener\("click",\s*copySummary\)/);
});
