const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "demo/role-tour.html"), "utf8");
test("role tour highlights sections per role", () => {
  assert.match(html, /lang="he" dir="rtl"/);
  assert.match(html, /מנהל חניון/);
  assert.match(html, /IT ופרטיות/);
  assert.match(html, /חדשנות/);
  assert.match(html, /data-role/);
});
