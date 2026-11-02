const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "pilot.html"), "utf8");
test("pilot page proposes a small measured trial without invented numbers", () => {
  assert.match(html, /lang="he" dir="rtl"/);
  assert.match(html, /אזור חניה אחד/);
  assert.match(html, /מצלמה אחת עד שתיים/);
  assert.match(html, /ארבעה שבועות/);
  assert.match(html, /הסכמה מול ספירה ידנית/);
  assert.match(html, /זמן עדכון/);
  assert.match(html, /לא שינוי מחסומים/);
  assert.match(html, /לא החלפת מערכת תשלום/);
  assert.doesNotMatch(html, /99\s?%/);
});
