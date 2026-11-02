const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "demo/fault-lab.html"), "utf8");
test("fault lab turns spot unknown on simulated faults", () => {
  assert.match(html, /lang="he" dir="rtl"/);
  assert.match(html, /המחשת ממשק/);
  assert.match(html, /מצלמה נותקה/);
  assert.match(html, /ראות חסומה/);
  assert.match(html, /מידע לא עדכני/);
  assert.match(html, /לא ידוע/);
});
