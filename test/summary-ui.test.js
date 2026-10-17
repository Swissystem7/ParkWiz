const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('pilot summary page has accessible status regions, copy buttons, and reactive hash handling', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-summary.html'), 'utf8');

  // Accessible live status regions
  assert.match(html, /id="banner"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="summaryStatus"[^>]*role="status"[^>]*aria-live="polite"/);

  // Semantic regions and accessible headings
  assert.match(html, /id="body"[^>]*role="region"[^>]*aria-labelledby="summaryTitle"/);
  assert.match(html, /<h2 id="summaryTitle">/);
  assert.match(html, /id="empty"[^>]*role="region"[^>]*aria-label="[^"]+"/);

  // Actionable toolbar buttons with accessible labels
  assert.match(html, /id="btnCopyLink"[^>]*aria-label="העתק קישור סיכום ללוח"/);
  assert.match(html, /id="btnCopySummary"[^>]*aria-label="העתק תקציר נתוני פיילוט ללוח"/);

  // Dynamic a11y labels on KPI elements
  assert.match(html, /kMeanEl\.setAttribute\("aria-label",\s*"דיוק ממוצע:\s*"\s*\+\s*meanStr\)/);
  assert.match(html, /kNEl\.setAttribute\("aria-label",\s*"תצפיות מזווגות:\s*"\s*\+\s*data\.count\)/);
  assert.match(html, /kPerfEl\.setAttribute\("aria-label",\s*"התאמה מלאה:\s*"\s*\+\s*data\.perfect\)/);

  // Guarded copy actions when empty
  assert.match(html, /if\s*\(!currentData\)\s*\{\s*setStatus\("אין קישור סיכום להעתקה\.",\s*true\);\s*return;\s*\}/);
  assert.match(html, /if\s*\(!currentData\)\s*\{\s*setStatus\("אין נתוני סיכום להעתקה\.",\s*true\);\s*return;\s*\}/);

  // Reactive hashchange event handling
  assert.match(html, /window\.addEventListener\("hashchange",\s*renderSummary\);/);
});
