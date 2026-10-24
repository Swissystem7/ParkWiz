const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('pilot atidim page has copy plan action, accessible status region, and a11y labels', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-atidim.html'), 'utf8');

  // Copy plan action button in toolbar
  assert.match(html, /<button type="button" id="btnCopyPlan">העתק תקציר תוכנית<\/button>/);

  // Accessible live status element for screen readers and user feedback
  assert.match(html, /id="planStatus"[^>]*role="status"[^>]*aria-live="polite"/);

  // Accessible table, list, and KPI region attributes
  assert.match(html, /<ul class="list" role="list" aria-label="אתגרי העומס בפארק עתידים">/);
  assert.match(html, /<table role="table" aria-label="תכולת המערכת מעל מצלמות קיימות">/);
  assert.match(html, /<div class="kpis" role="region" aria-label="חלוקת מקומות החניה לפי אזורים ומצלמות">/);
  assert.match(html, /<ul class="list" role="list" aria-label="עקרונות פרטיות ואבטחת מידע">/);
  assert.match(html, /<ul class="list" role="list" aria-label="מסמכי חבילה משפטית">/);
  assert.match(html, /<table role="table" aria-label="תוכנית עבודה 4 שבועות לפיילוט">/);
  assert.match(html, /<ol class="list" role="list" aria-label="מדדי הצלחה מספריים לפיילוט">/);
  assert.match(html, /<ol class="list" role="list" aria-label="דרישות תשתית וקשר מעתידים">/);

  // Summary generation function for clipboard export
  assert.match(html, /function getPlanSummaryText\(\)/);
  assert.match(html, /ParkWiz — תוכנית פיילוט לחניוני פארק עתידים \(4 שבועות\)/);
  assert.match(html, /הבעיה/);
  assert.match(html, /מה המערכת נותנת/);
  assert.match(html, /פריסת תאים ומצלמות/);
  assert.match(html, /פרטיות מובטחת/);
  assert.match(html, /מסלול הפיילוט/);
  assert.match(html, /מדדי הצלחה/);
  assert.match(html, /מה נדרש מעתידים/);

  // Clipboard copy listener with fallback and status announcement
  assert.match(html, /document\.getElementById\("btnCopyPlan"\)\.addEventListener\("click",/);
  assert.match(html, /navigator\.clipboard\.writeText\(text\)/);
  assert.match(html, /document\.createElement\("textarea"\)/);
  assert.match(html, /setStatus\("תקציר תוכנית הפיילוט הועתק ללוח בהצלחה\."\)/);
});
