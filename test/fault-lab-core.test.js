const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const lab = require("../src/lib/fault-lab.js");

test("fresh free reading shows free, a freshness stamp and no-reservation alert", () => {
  const v = lab.spotView({ reading: "free", ageSec: 4 });
  assert.equal(v.state, "free");
  assert.equal(v.stampHe, "עודכן לפני 4 שניות");
  assert.equal(v.alertVisible, true);
  assert.match(v.alertHe, /אין שמירת מקום/);
});

test("every fault turns the spot unknown and hides the driver alert", () => {
  for (const fault of Object.keys(lab.FAULTS)) {
    for (const reading of ["free", "occupied"]) {
      const v = lab.spotView({ reading, fault, ageSec: 4 });
      assert.equal(v.state, "unknown");
      assert.equal(v.labelHe, "לא ידוע");
      assert.equal(v.alertVisible, false);
      assert.match(v.operatorHe, /צריך לבדוק/);
    }
  }
});

test("data older than 5 minutes is unknown even with no fault flagged", () => {
  assert.equal(lab.spotView({ reading: "free", ageSec: lab.STALE_AFTER_SEC }).state, "free");
  const v = lab.spotView({ reading: "free", ageSec: lab.STALE_AFTER_SEC + 1 });
  assert.equal(v.state, "unknown");
  assert.equal(v.reasonHe, "מידע לא עדכני");
  assert.match(v.stampHe, /לא מציגים כעדכני/);
});

test("output carries no image, url or plate fields", () => {
  const keys = Object.keys(lab.spotView({ reading: "free", fault: "camera" }));
  assert.deepEqual(keys.sort(), ["alertHe", "alertVisible", "labelHe", "operatorHe", "reasonHe", "stampHe", "state"]);
});

test("fault lab page loads the core and keeps the original controls", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "demo/fault-lab.html"), "utf8");
  assert.match(html, /src="\.\.\/src\/lib\/fault-lab\.js"/);
  for (const id of ["spot", "why", "reset", "stamp", "alert", "ops"]) assert.match(html, new RegExp('id="' + id + '"'));
  assert.doesNotMatch(html, /https?:\/\/(?!www\.w3\.org)/);
});
