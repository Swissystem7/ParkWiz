const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "demo/meeting-qa.html"), "utf8");
test("meeting QA separates what works today from what is not yet tested", () => {
  assert.match(html, /lang="he" dir="rtl"/);
  assert.match(html, /מה עובד היום/);
  assert.match(html, /מה עוד לא נבדק/);
  assert.match(html, /אין נתון מאומת/);
  assert.match(html, /שאלות ותשובות למפעיל חניון/);
  assert.match(html, /מעל 5 דקות/);
  assert.match(html, /הסכמה מול ספירה ידנית/);
  assert.doesNotMatch(html, /99\s?%/);
});
