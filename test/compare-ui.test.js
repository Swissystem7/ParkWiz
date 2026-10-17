const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('pilot compare page has accessible regions, tables, live status elements, empty states, and copy stats button', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-compare.html'), 'utf8');

  // Empty states for pending and saved pairs
  assert.match(html, /<p class="hint" id="pendingEmpty">אין הערכות ממתינות\.<\/p>/);
  assert.match(html, /<p class="hint" id="pairEmpty">אין זוגות שנשמרו עדיין\.<\/p>/);

  // Accessible live status regions
  assert.match(html, /id="addStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="exportStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="verdictBox"[^>]*role="status"[^>]*aria-live="polite"/);

  // Accessible regions and tables
  assert.match(html, /<section class="panel hero"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /<section class="panel"[^>]*role="region"[^>]*aria-label="הוספת תצפית שדה"/);
  assert.match(html, /<section class="panel"[^>]*role="region"[^>]*aria-label="הערכות ממתינות לספירה"/);
  assert.match(html, /<section class="panel"[^>]*role="region"[^>]*aria-label="זוגות שנשמרו"/);
  assert.match(html, /<table role="table" aria-label="הערכות תפוסה ממתינות לספירת פקח">/);
  assert.match(html, /<table role="table" aria-label="זוגות תצפיות שנשמרו">/);

  // Copy stats button
  assert.match(html, /<button type="button" id="btnCopyStats">העתק תמצית מדדים<\/button>/);
  assert.match(html, /document\.getElementById\("btnCopyStats"\)\.addEventListener\("click"/);
  assert.match(html, /if \(!pairs\.length\) \{[\s\S]*?setStatus\("addStatus", "אין זוגות להעתקת תמצית מדדים\."\);[\s\S]*?return; \}/);

  // Pending save button a11y label and status announcement
  assert.match(html, /btn\.setAttribute\("aria-label",\s*"שמור זוג עבור פריים "\s*\+\s*\(rec\.frame != null \? rec\.frame : idx \+ 1\)\)/);
  assert.match(html, /setStatus\("addStatus",\s*"נשמר זוג לפריים "\s*\+\s*\(rec\.frame != null \? rec\.frame : idx \+ 1\)/);

  // Robust occupancy file upload feedback
  assert.match(html, /document\.getElementById\("fileOcc"\)\.addEventListener\("change"/);
  assert.match(html, /setStatus\("addStatus",\s*"נטענו "\s*\+\s*list\.length\s*\+\s*" הערכות ממתינות מ־occupancy\.json\."\)/);

  // Kit loading feedback
  assert.match(html, /setStatus\("addStatus",\s*"נטענו "\s*\+\s*recs\.length\s*\+\s*" הערכות ממתינות מערכת הפיילוט\."\)/);
});
