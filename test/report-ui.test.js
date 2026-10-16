const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('pilot report page has empty state for records and accessible status regions', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-report.html'), 'utf8');
  assert.match(html, /<p class="hint" id="recordsEmpty">/);
  assert.match(html, /document\.getElementById\("recordsEmpty"\)\.style\.display\s*=\s*records\.length \? "none" : "block"/);
  assert.match(html, /id="reportStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="accOut"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /getElementById\("btnCsv"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if \(!records\.length\) \{ setStatus\("אין רשומות לייצוא\."\); return; \}/);
  assert.match(html, /getElementById\("btnJson"\)\.addEventListener\("click",\s*\(\)\s*=>\s*\{[\s\S]*?if \(!records\.length\) \{ setStatus\("אין רשומות לייצוא\."\); return; \}/);
});
