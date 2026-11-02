const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
test("homepage leads with one clear meeting message and one primary demo CTA", () => {
  assert.match(html, /איפה יש מקום פנוי בחניון/);
  assert.match(html, /לדמו חניון עתידים/);
  assert.match(html, /בלי לשמור וידאו, פנים או לוחיות רישוי/);
});
test("homepage local links resolve to files that exist", () => {
  const root = path.join(__dirname, "..");
  for (const m of html.matchAll(/href="(\.\/[^"#?]+)"/g)) {
    assert.ok(fs.existsSync(path.join(root, m[1])), `broken link: ${m[1]}`);
  }
});
