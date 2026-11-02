const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "demo/meeting-ops.html"), "utf8");
test("meeting ops covers boundaries alerts toggles compat and closing", () => {
  assert.match(html, /lang="he" dir="rtl"/);
  assert.match(html, /המחשת ממשק/);
  assert.match(html, /באזור הניסוי/);
  assert.match(html, /אין שמירת מקום/);
  assert.match(html, /השהה התראות/);
  assert.match(html, /בלי ציון ובלי הבטחה/);
  assert.match(html, /ביטול גישה/);
});
