const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
for (const rel of ["demo/atidim-board.html", "demo/commute.html"]) {
  test(`${rel} shows update age and marks data older than 5 minutes as stale`, () => {
    const html = fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
    assert.match(html, /pwFreshness/);
    assert.match(html, /עודכן לפני/);
    assert.match(html, /יותר מ-5 דקות/);
    assert.match(html, /יכול להיתפס אחריו/);
    assert.match(html, /sec>300/);
  });
}
