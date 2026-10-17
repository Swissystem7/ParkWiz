const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('pilot report page has empty state for records, chart, heatmap, and accessible status regions', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-report.html'), 'utf8');

  // Empty state elements for records table, chart, and heatmap
  assert.match(html, /<p class="hint" id="recordsEmpty">/);
  assert.match(html, /<p class="hint" id="chartEmpty"[^>]*style="display:\s*none/);
  assert.match(html, /<p class="hint" id="heatEmpty"[^>]*style="display:\s*none/);

  // Dynamic toggling of empty states in render
  assert.match(html, /document\.getElementById\("recordsEmpty"\)\.style\.display\s*=\s*records\.length \? "none" : "block"/);
  assert.match(html, /chartEmpty\.style\.display\s*=\s*records\.length \? "none" : "block"/);
  assert.match(html, /heatEmpty\.style\.display\s*=\s*records\.length \? "none" : "block"/);

  // Accessible live status elements
  assert.match(html, /id="reportStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="accOut"[^>]*role="status"[^>]*aria-live="polite"/);

  // Toolbar semantics and aria labels
  assert.match(html, /<div class="toolbar no-print"[^>]*role="toolbar"[^>]*aria-label="פעולות דוח פיילוט"/);
  assert.match(html, /id="btnPrint"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnCsv"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnJson"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnCopySummary"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnSample"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnFromKit"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnClear"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnAcc"[^>]*aria-label="[^"]+"/);

  // Guard exports and copy when empty
  assert.match(html, /getElementById\("btnCsv"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if \(!records\.length\) \{ setStatus\("אין רשומות לייצוא\."\); return; \}/);
  assert.match(html, /getElementById\("btnJson"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if \(!records\.length\) \{ setStatus\("אין רשומות לייצוא\."\); return; \}/);
  assert.match(html, /function copySummary\(\)\s*\{[\s\S]*?if \(!records\.length\) \{[\s\S]*?setStatus\("אין נתוני דוח להעתקה\."\);[\s\S]*?return;/);

  // Clear data implementation
  assert.match(html, /function clearData\(\)\s*\{[\s\S]*?records\s*=\s*\[\];[\s\S]*?localStorage\.removeItem\(LS_OCC\);[\s\S]*?render\(\);[\s\S]*?setStatus\("כל נתוני הדוח נוקו\."\);/);

  // Table header accessibility
  assert.match(html, /<th scope="col">זמן<\/th>/);
  assert.match(html, /<th scope="col">תפוסים<\/th>/);
  assert.match(html, /<th scope="col">סך הכול<\/th>/);

  // Accessible panel regions
  assert.match(html, /<section class="panel" role="region" aria-labelledby="secChart">/);
  assert.match(html, /<section class="panel" role="region" aria-labelledby="secHeat">/);
  assert.match(html, /<section class="panel" role="region" aria-labelledby="secRecords">/);
});
