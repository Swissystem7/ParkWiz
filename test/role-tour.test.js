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

test("role tour adds the digest points per role (research-06)", () => {
  const h = fs.readFileSync(path.join(__dirname, "..", "demo/role-tour.html"), "utf8");
  assert.match(h, /בלי שינוי בתשלום או במחסומים/);
  assert.match(h, /אינה שומרת וידאו ואינה קוראת לוחיות/);
  assert.match(h, /אם אין יתרון — עוצרים/);
  assert.match(h, /aria-pressed/);
  for (const href of ["free-for-whom.html", "meeting-ops.html", "results-calculator.html"]) assert.ok(h.includes('href="./' + href + '"'));
  const ops = fs.readFileSync(path.join(__dirname, "..", "demo/meeting-ops.html"), "utf8");
  assert.match(ops, /מחוץ לכיסוי — לא מוצג כפנוי ואין התראה/);
  assert.match(ops, /לא נבדק — מוצג כלא ידוע/);
});
