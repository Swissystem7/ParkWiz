const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('pilot methodology page has copy actions, accessible status region, fallback handling, and a11y labels', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-method.html'), 'utf8');

  // Accessible status element
  assert.match(html, /id="methodStatus"[^>]*role="status"[^>]*aria-live="polite"/);

  // Copy buttons
  assert.match(html, /<button type="button" id="btnCopyMethod">העתק תקציר מתודולוגיה<\/button>/);
  assert.match(html, /<button type="button" id="btnCopyConsts">העתק קבועים \(JSON\)<\/button>/);

  // Table accessibility
  assert.match(html, /<table role="table" aria-label="רמות ביטחון לפי שיטה">/);
  assert.match(html, /<table role="table" aria-label="כשלים ידועים והתמודדות">/);
  assert.match(html, /<table role="table" aria-label="מה נכלל באלגוריתם ומה לא">/);

  // List accessibility
  assert.match(html, /<ul role="list" aria-label="שדות שקיפות המוחזרים מההערכה">/);
  assert.match(html, /<ol role="list" aria-label="שלבי צינור הפיקסלים">/);
  assert.match(html, /<ol role="list" aria-label="שלבי ביקורת עירייה">/);

  // Code region
  assert.match(html, /id="constDump"[^>]*role="region"/);

  // Summary generation function for clipboard export
  assert.match(html, /function getMethodologySummaryText\(\)/);
  assert.match(html, /ParkWiz — מתודולוגיית תפוסה/);

  // Graceful handling of missing ParkWizHeuristic
  assert.match(html, /if\s*\(!H\)\s*\{[\s\S]*?dumpEl\.textContent\s*=\s*"[\s\S]*?לא נטען/);

  // Clipboard copy handlers
  assert.match(html, /document\.getElementById\("btnCopyMethod"\)/);
  assert.match(html, /document\.getElementById\("btnCopyConsts"\)/);
  assert.match(html, /"תקציר המתודולוגיה הועתק ללוח בהצלחה\."/);
  assert.match(html, /"קבועי ההיוריסטיקה הועתקו כ-JSON ללוח\."/);
});
