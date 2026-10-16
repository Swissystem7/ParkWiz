const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('pilot eval page has empty states, accessible status region, and a11y labels', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-eval.html'), 'utf8');

  // Accessible live status element
  assert.match(html, /id="evalStatus"[^>]*role="status"[^>]*aria-live="polite"/);

  // Accessible table labels and regions
  assert.match(html, /<table[^>]*aria-label="הסכמה לפי תנאי תאורה"/);
  assert.match(html, /<table[^>]*aria-label="הסכמה וכשלים לפי סצנה"/);
  assert.match(html, /role="region"[^>]*aria-labelledby="rawTitle"/);

  // Empty state elements for lighting and scenes
  assert.match(html, /<p class="hint" id="lightEmpty"[^>]*style="display:\s*none/);
  assert.match(html, /<p class="hint" id="sceneEmpty"[^>]*style="display:\s*none/);

  // Copy JSON button wired to copy and announce status
  assert.match(html, /id="btnCopyJson"/);
  assert.match(html, /btnCopyJson.*addEventListener\("click"/);
  assert.match(html, /setStatus\("דוח הערכה בפורמט JSON הועתק ללוח\."\)/);

  // Run button announces status
  assert.match(html, /setStatus\("ההערכה חושבה מחדש על מערך הנתונים המסונתז\."\)/);
});
