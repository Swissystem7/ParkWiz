const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('pilot log page has empty state, accessible status and verdict regions, and guarded exports', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-log.html'), 'utf8');

  // Accessible live status element
  assert.match(html, /id="status"[^>]*role="status"[^>]*aria-live="polite"/);

  // Accessible region and empty state for 30 days grid
  assert.match(html, /id="dayGrid"[^>]*role="region"[^>]*aria-label="30 ימי פיילוט"/);
  assert.match(html, /<p class="hint" id="daysEmpty"[^>]*style="display:\s*none[;"]/);
  assert.match(html, /daysEmpty\.style\.display\s*=\s*filledCount \? "none" : "block"/);

  // Accessible verdict region
  assert.match(html, /id="verdictBox"[^>]*role="region"[^>]*aria-live="polite"[^>]*aria-labelledby="verdictLabel"/);

  // Guard CSV and JSON export when no filled days exist
  assert.match(html, /getElementById\("btnCsv"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if \(!PRO\.filledDays\(state\.days\)\.length\) \{[\s\S]*?setStatus\("אין ימים עם ספירה לייצוא\."\);[\s\S]*?return;/);
  assert.match(html, /getElementById\("btnJson"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if \(!PRO\.filledDays\(state\.days\)\.length\) \{[\s\S]*?setStatus\("אין ימים עם ספירה לייצוא\."\);[\s\S]*?return;/);
});

test('pilot log page has accessible status regions, empty states, copy/reset actions, and button guards', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-log.html'), 'utf8');

  // Accessible live status element
  assert.match(html, /id="status"[^>]*role="status"[^>]*aria-live="polite"/);

  // Empty state elements for day grid and heat map
  assert.match(html, /id="daysEmpty"/);
  assert.match(html, /id="heatEmpty"/);

  // Accessible regions and panels
  assert.match(html, /class="kpis"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="verdictBox"[^>]*role="region"[^>]*aria-label(?:ledby)?="[^"]+"/);
  assert.match(html, /id="dayGrid"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="heat"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /<section class="panel"[^>]*role="region"[^>]*aria-labelledby="hVerdict"/);
  assert.match(html, /<section class="panel"[^>]*role="region"[^>]*aria-labelledby="hFlags"/);
  assert.match(html, /<section class="panel"[^>]*role="region"[^>]*aria-labelledby="hDays"/);
  assert.match(html, /<section class="panel"[^>]*id="editorPanel"[^>]*role="region"[^>]*aria-labelledby="editorTitle"/);
  assert.match(html, /<section class="panel"[^>]*role="region"[^>]*aria-labelledby="hHeat"/);

  // Accessible attributes on form controls and action buttons
  assert.match(html, /id="btnSample"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnFromPairs"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="fileLog"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnCopySummary"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnCsv"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnJson"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnResetFlags"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnClear"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnSaveDay"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="btnClearDay"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="streetName"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="startDate"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="outreach"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="eDate"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="eLight"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="eTotal"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="eSys"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="eMan"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="eNote"[^>]*aria-label="[^"]+"/);

  // Guards against operations when log is empty
  assert.match(html, /getElementById\("btnCsv"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!PRO\.filledDays\(state\.days\)\.length\)\s*\{\s*setStatus\("אין ימים עם ספירה לייצוא\."\);\s*return;\s*\}/);
  assert.match(html, /getElementById\("btnJson"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!PRO\.filledDays\(state\.days\)\.length\)\s*\{\s*setStatus\("אין ימים עם ספירה לייצוא\."\);\s*return;\s*\}/);
  assert.match(html, /getElementById\("btnClear"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(!PRO\.filledDays\(state\.days\)\.length\)\s*\{\s*setStatus\("היומן כבר ריק\."\);\s*return;\s*\}/);

  // Copy summary: empty log is announced on #status, then the clipboard is tried.
  assert.match(html, /function buildSummaryText\(\)\s*\{[\s\S]*?if\s*\(!filled\.length\)\s*return\s*"";/);
  assert.match(html, /async function copySummary\(\)\s*\{[\s\S]*?if\s*\(!text\)\s*\{\s*setStatus\("אין ימים עם ספירה להעתקת סיכום\.",\s*true\);\s*return;\s*\}/);
  assert.match(html, /document\.getElementById\("btnCopySummary"\)\.addEventListener\("click",\s*copySummary\)/);

  // Reset flags function implementation and listener
  assert.match(html, /function resetFlags\(\)\s*\{[\s\S]*?state\.days\s*=\s*PRO\.buildCalendar\("2026-08-01",\s*30\);/);
  assert.match(html, /document\.getElementById\("btnResetFlags"\)\.addEventListener\("click",\s*resetFlags\)/);

  // Dynamic a11y on days
  assert.match(html, /btn\.setAttribute\("aria-pressed",\s*d\.day === state\.selected \? "true" : "false"\)/);
  assert.match(html, /btn\.setAttribute\("aria-label",\s*"יום "\s*\+\s*d\.day/);
});
