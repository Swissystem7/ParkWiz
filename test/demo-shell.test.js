const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const pages = ["demo/atidim.html", "demo/camera.html", "demo/atidim-board.html", "demo/commute.html"];
for (const rel of pages) {
  test(`${rel} uses the shared demo shell with a clear demo badge and lede`, () => {
    const html = fs.readFileSync(path.join(root, rel), "utf8");
    assert.match(html, /lang="he" dir="rtl"/);
    assert.match(html, /demo-shell\.css/);
    assert.match(html, /pw-demo-badge/);
    assert.match(html, /דמו להמחשה/);
    assert.match(html, /pw-demo-lede|מה רואים כאן|דמו מפעיל/);
  });
}
test("demo shell guards narrow screens against sideways scroll", () => {
  const css = fs.readFileSync(path.join(root, "src/ui/demo-shell.css"), "utf8");
  assert.match(css, /max-width:100%/);
  assert.match(css, /min-width:0/);
  assert.match(css, /--pw-brand/);
});
