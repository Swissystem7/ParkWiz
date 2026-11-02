const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "demo/trial-card.html"), "utf8");
test("trial card is a printable shared draft form", () => {
  assert.match(html, /lang="he" dir="rtl"/);
  assert.match(html, /טיוטת עבודה/);
  assert.match(html, /אזור הניסוי/);
  assert.match(html, /תנאי עצירה/);
  assert.match(html, /window\.print/);
  assert.match(html, /נשמרים בדפדפן בלבד/);
});
