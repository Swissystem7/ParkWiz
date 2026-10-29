const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'pilot-log.html'), 'utf8');

test('exactly one role="status" aria-live="polite" element exists and it is #status', () => {
  const statusMatches = html.match(/role="status"/g) || [];
  assert.equal(statusMatches.length, 1);
  const politeStatus = html.match(/<[^>]*role="status"[^>]*aria-live="polite"[^>]*>/g) || [];
  assert.equal(politeStatus.length, 1);
  assert.match(html, /id="status"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
});

test('"העתק סיכום" and "אפס תנאי פיילוט" start disabled', () => {
  assert.match(html, /<button[^>]*id="btnCopySummary"[^>]*disabled[^>]*>העתק סיכום<\/button>/);
  assert.match(html, /<button[^>]*id="btnResetFlags"[^>]*disabled[^>]*>אפס תנאי פיילוט<\/button>/);
  assert.match(html, /<button[^>]*id="btnCsv"[^>]*disabled[^>]*>ייצוא CSV<\/button>/);
  assert.match(html, /<button[^>]*id="btnJson"[^>]*disabled[^>]*>ייצוא JSON<\/button>/);
  assert.match(html, /<button[^>]*id="btnClear"[^>]*disabled[^>]*>מחק יומן בדפדפן זה<\/button>/);
});

test('copy wiring uses clipboard API with execCommand fallback', () => {
  assert.match(html, /getElementById\("btnCopySummary"\)\.addEventListener\("click", copySummary\)/);
  assert.match(html, /async function copySummary\(\)/);
  assert.match(html, /function buildSummaryText\(\)/);
  assert.match(html, /navigator\.clipboard\.writeText\(text\)/);
  assert.match(html, /function copyTextFallback\(text\)/);
  assert.match(html, /document\.execCommand\("copy"\)/);
  assert.match(html, /copyTextFallback\(text\)/);
});

test('reset wiring clears the stored log and meta keys', () => {
  assert.match(html, /getElementById\("btnResetFlags"\)\.addEventListener\("click", resetFlags\)/);
  const body = html.match(/function resetFlags\(\)\s*\{[\s\S]*?\n\}/)[0];
  assert.match(body, /localStorage\.removeItem\(OCC\.LS\.log\)/);
  assert.match(body, /localStorage\.removeItem\(LS_META\)/);
  assert.match(body, /state\.days = PRO\.buildCalendar\("2026-08-01", 30\)/);
  assert.match(body, /state\.selected = 1/);
  assert.match(body, /setStatus\("תנאי הפיילוט והיומן אופסו לברירת המחדל\."\)/);
  assert.doesNotMatch(body, /persist\(\)/);
});

test('copy stays disabled without counted days; reset stays disabled without edits or stored data', () => {
  assert.match(html, /function hasResettableLog\(\)/);
  assert.match(html, /localStorage\.getItem\(OCC\.LS\.log\)/);
  assert.match(html, /const noFilled = PRO\.filledDays\(state\.days\)\.length === 0/);
  assert.match(html, /copyBtn\.disabled = noFilled/);
  assert.match(html, /csvBtn\.disabled = noFilled/);
  assert.match(html, /jsonBtn\.disabled = noFilled/);
  assert.match(html, /clearBtn\.disabled = noFilled/);
  assert.match(html, /resetBtn\.disabled = !hasResettableLog\(\)/);
  assert.match(html, /renderHeat\(\);\s*refreshActionButtons\(\);/);
});
