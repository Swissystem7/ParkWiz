const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ap = require("../src/lib/alert-path.js");

test("an active alert carries a time stamp, an expiry and no-reservation wording", () => {
  const a = ap.alertCard({ stage: "available", ageSec: 30 });
  assert.equal(a.shown, true);
  assert.match(a.textHe, /עודכן לפני 30 שניות/);
  assert.match(a.textHe, /תפוגה בעוד 4 דקות/);
  assert.match(a.textHe, /אין שמירת מקום/);
});

test("the alert expires and is cancelled when the spot is taken", () => {
  assert.equal(ap.alertCard({ stage: "available", ageSec: ap.EXPIRE_AFTER_SEC }).status, "expired");
  const t = ap.alertCard({ stage: "taken", ageSec: 5 });
  assert.equal(t.shown, false);
  assert.equal(t.status, "cancelled");
  assert.equal(ap.alertCard({ stage: "occupied" }).shown, false);
});

test("operator pause / close zone / measure-only suppress every alert", () => {
  for (const key of ["pauseAlerts", "closeZone", "measureOnly"]) {
    const a = ap.alertCard({ stage: "freed", ageSec: 1, ops: { [key]: true } });
    assert.equal(a.shown, false);
    assert.equal(a.status, "suppressed");
  }
});

test("alert output has no image, url or plate fields", () => {
  assert.deepEqual(Object.keys(ap.alertCard({ stage: "freed" })).sort(), ["shown", "status", "textHe"]);
});

test("meeting-ops page wires the alert core and keeps the original controls", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "demo/meeting-ops.html"), "utf8");
  assert.match(html, /src="\.\.\/src\/lib\/alert-path\.js"/);
  for (const id of ["alertState", "stepBtn", "alertCard", "ageBtn", "pauseAlerts", "closeZone", "measureOnly", "opsMsg"]) assert.match(html, new RegExp('id="' + id + '"'));
});
