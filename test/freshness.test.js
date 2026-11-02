const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
for (const rel of ["demo/atidim-board.html", "demo/commute.html"]) {
  test(`${rel} loads the freshness indicator`, () => {
    const html = fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
    assert.match(html, /pwFreshness/);
    assert.match(html, /src\/lib\/freshness\.js/);
  });
}
test("freshness script shows update age and marks data older than 5 minutes as stale", () => {
  const js = fs.readFileSync(path.join(__dirname, "..", "src/lib/freshness.js"), "utf8");
  assert.match(js, /עודכן לפני/);
  assert.match(js, /יותר מ-5 דקות/);
  assert.match(js, /יכול להיתפס אחריו/);
  assert.match(js, /sec > 300|sec>300/);
});
