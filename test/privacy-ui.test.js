const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('pilot privacy page has accessible live status region, action buttons, and form a11y', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-privacy.html'), 'utf8');

  // Accessible live status region
  assert.match(html, /id="privacyStatus"[^>]*role="status"[^>]*aria-live="polite"/);

  // Action buttons in toolbar
  assert.match(html, /id="btnPrint"/);
  assert.match(html, /id="btnFill30"/);
  assert.match(html, /id="btnCopyRequest"/);
  assert.match(html, /id="btnReset"/);

  // Status feedback and notifications
  assert.match(html, /function setStatus\(msg,\s*isWarn\)/);
  assert.match(html, /setStatus\("התאריכים עודכנו ל-30 יום החל מהיום\."\)/);
  assert.match(html, /setStatus\("טופס הבקשה אופס לברירת המחדל\."\)/);
  assert.match(html, /setStatus\("פרטי הבקשה הועתקו ללוח\."\)/);
  assert.match(html, /if \(!contact \|\| !cam\) \{[\s\S]*?setStatus\("שים לב: מומלץ למלא איש קשר ומצלמה מבוקשת לפני הדפסה\.",\s*true\);/);

  // Copy summary logic
  assert.match(html, /function getRequestSummary\(\)/);
  assert.match(html, /function copyRequest\(\)/);

  // Reset form logic
  assert.match(html, /function resetForm\(\)/);
  assert.match(html, /localStorage\.removeItem\("pw_priv_"\s*\+\s*id\)/);

  // Accessibility attributes on form inputs and panels
  assert.match(html, /id="org"[^>]*aria-required="true"/);
  assert.match(html, /id="contact"[^>]*aria-required="true"/);
  assert.match(html, /id="cam"[^>]*aria-required="true"/);
  assert.match(html, /id="start"[^>]*aria-label="תאריך תחילת פיילוט"/);
  assert.match(html, /id="end"[^>]*aria-label="תאריך סיום פיילוט"/);
  assert.match(html, /id="notes"[^>]*aria-label="הערות לבקשת הגישה"/);
  assert.match(html, /aria-labelledby="sec1"/);
  assert.match(html, /aria-labelledby="sec2"/);
  assert.match(html, /aria-labelledby="sec3"/);
  assert.match(html, /aria-labelledby="sec4"/);
  assert.match(html, /aria-labelledby="sec5"/);
});
