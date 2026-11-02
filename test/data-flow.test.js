const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "demo/data-flow.html"), "utf8");
test("data-flow page explains processing, occupancy-only output and deletion", () => {
  assert.match(html, /lang="he" dir="rtl"/);
  assert.match(html, /מידע תפוסה בלבד/);
  assert.match(html, /לא נשמר וידאו/);
  assert.match(html, /אין זיהוי פנים ואין קריאת לוחיות רישוי/);
  assert.match(html, /ביטול גישה ומחיקה בסיום/);
  assert.match(html, /מוחקים את נתוני התפוסה/);
});
