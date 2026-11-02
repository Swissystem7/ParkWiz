const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "demo/free-for-whom.html"), "utf8");
test("free-for-whom filters spots by user type", () => {
  assert.match(html, /lang="he" dir="rtl"/);
  assert.match(html, /המחשת ממשק/);
  assert.match(html, /מבקר/);
  assert.match(html, /שמור/);
  assert.match(html, /טעינה/);
  assert.match(html, /נגיש/);
  assert.match(html, /data-user/);
});
