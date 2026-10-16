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
  assert.match(html, /<p class="hint" id="daysEmpty"[^>]*style="display:\s*none"/);
  assert.match(html, /daysEmpty\.style\.display\s*=\s*filledCount \? "none" : "block"/);

  // Accessible verdict region
  assert.match(html, /id="verdictBox"[^>]*role="region"[^>]*aria-live="polite"[^>]*aria-labelledby="verdictLabel"/);

  // Guard CSV and JSON export when no filled days exist
  assert.match(html, /getElementById\("btnCsv"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if \(!PRO\.filledDays\(state\.days\)\.length\) \{[\s\S]*?setStatus\("אין ימים עם ספירה לייצוא\."\);[\s\S]*?return;/);
  assert.match(html, /getElementById\("btnJson"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if \(!PRO\.filledDays\(state\.days\)\.length\) \{[\s\S]*?setStatus\("אין ימים עם ספירה לייצוא\."\);[\s\S]*?return;/);
});
