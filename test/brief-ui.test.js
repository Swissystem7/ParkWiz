const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('pilot brief page has copy action, accessible status region, and a11y labels', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-brief.html'), 'utf8');

  // Copy brief action button in toolbar
  assert.match(html, /<button type="button" id="btnCopyBrief">העתק תקציר למסמך<\/button>/);

  // Accessible live status element for screen readers and user feedback
  assert.match(html, /id="briefStatus"[^>]*role="status"[^>]*aria-live="polite"/);

  // Accessible table, list, and KPI region attributes
  assert.match(html, /<table role="table" aria-label="מה נכלל בפיילוט ומה לא">/);
  assert.match(html, /<ol class="steps" role="list" aria-label="שלבי הרצת 30 הימים">/);
  assert.match(html, /<div class="kpis" role="region" aria-label="מדדי כלל העצירה">/);

  // Summary generation function for clipboard export
  assert.match(html, /function getBriefSummaryText\(\)/);
  assert.match(html, /ParkWiz — תקציר לפיילוט 30 יום/);
  assert.match(html, /הבקשה במשפט אחד/);
  assert.match(html, /מה בפנים/);
  assert.match(html, /מה בחוץ/);
  assert.match(html, /כלל העצירה/);

  // Clipboard copy listener with fallback and status announcement
  assert.match(html, /document\.getElementById\("btnCopyBrief"\)\.addEventListener\("click",/);
  assert.match(html, /navigator\.clipboard\.writeText\(text\)/);
  assert.match(html, /document\.createElement\("textarea"\)/);
  assert.match(html, /setStatus\("תקציר הפיילוט הועתק ללוח בהצלחה\."\)/);
});
