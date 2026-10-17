const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'demo', 'atidim-board.html');

test('atidim-board page has accessible status regions and copy buttons', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Accessible live status element for board announcements
  assert.match(html, /id="boardStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /\.board-status\s*\{/);

  // Copy action buttons in toolbar and arrival margin controls
  assert.match(html, /<button id="btnCopyBoard"[^>]*>העתק תקציר לוח<\/button>/);
  assert.match(html, /<button id="btnCopyMargin"[^>]*>העתק חלון הגעה<\/button>/);

  // Dynamic canvas aria-label update
  assert.match(html, /canvas\.setAttribute\("aria-label",\s*"מפת חניות: "\s*\+\s*snap\.free\s*\+\s*" פנויים מתוך "\s*\+\s*snap\.total\s*\+\s*" בשעה "\s*\+\s*label\(hour\)\)/);

  // Announcement and clipboard helper wiring
  assert.match(html, /function announce\(msg,\s*isErr\)/);
  assert.match(html, /function copyToClipboard\(text,\s*successMsg\)/);

  // Graceful fallback when modules are missing
  assert.match(html, /if\s*\(!LOT\s*\|\|\s*!OCC\s*\|\|\s*!MARGIN\)\s*\{[\s\S]*?announce\("מודולי החניון לא נטענו במלואם — נא לרענן את הדף\.",\s*true\);/);

  // Announcement messages on user interactions
  assert.match(html, /announce\("שעה שונתה ל-"\s*\+\s*label\(hour\)/);
  assert.match(html, /announce\("חזרה לשעה הנוכחית \("\s*\+\s*label\(hour\)\s*\+\s*"\) · "/);
  assert.match(html, /announce\("זמן נסיעה עודכן: "/);
  assert.match(html, /announce\("שולי ביטחון עודכנו: ±"/);

  // Copy buttons click handlers
  assert.match(html, /copyBoardBtn\.addEventListener\("click"/);
  assert.match(html, /copyMarginBtn\.addEventListener\("click"/);
  assert.match(html, /"תקציר לוח המפעיל הועתק ללוח\."/);
  assert.match(html, /"פרטי חלון ההגעה הועתקו ללוח\."/);
});
