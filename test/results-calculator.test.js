const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "demo/results-calculator.html"), "utf8");
test("results calculator only shows result after manual input and explains denominator", () => {
  assert.match(html, /lang="he" dir="rtl"/);
  assert.match(html, /המחשת ממשק/);
  assert.match(html, /עדיין לא הוזנו נתונים/);
  assert.match(html, /המכנה/);
  assert.match(html, /ספירה ידנית/);
  assert.doesNotMatch(html, /99\s?%/);
});
