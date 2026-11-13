const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const el = require("../src/lib/eligibility.js");

const SPOTS = [
  { id: "A1", kind: "regular", state: "free" },
  { id: "A2", kind: "reserved", state: "free" },
  { id: "A3", kind: "ev", state: "free" },
  { id: "A4", kind: "accessible", state: "free" },
  { id: "A5", kind: "regular", state: "unknown" },
  { id: "A6", kind: "regular", state: "occupied" },
];
const ids = (list) => list.map((s) => s.id);

test("a visitor is offered only free regular spots", () => {
  assert.deepEqual(ids(el.suggest(SPOTS, "visitor")), ["A1"]);
});

test("special spots go only to their own driver type, plus regular spots", () => {
  assert.deepEqual(ids(el.suggest(SPOTS, "reserved")), ["A1", "A2"]);
  assert.deepEqual(ids(el.suggest(SPOTS, "ev")), ["A1", "A3"]);
  assert.deepEqual(ids(el.suggest(SPOTS, "accessible")), ["A1", "A4"]);
});

test("free but not allowed is said plainly, unknown is never suggested", () => {
  assert.equal(el.judge(SPOTS[3], "visitor").verdict, "not-allowed");
  assert.match(el.judge(SPOTS[3], "visitor").textHe, /לא מותר/);
  for (const u of ["visitor", "reserved", "ev", "accessible"]) {
    assert.equal(el.judge(SPOTS[4], u).verdict, "unknown");
    assert.equal(el.judge(SPOTS[5], u).verdict, "not-free");
  }
});

test("unknown spot kind or user type is never allowed", () => {
  assert.equal(el.isAllowed("vip", "visitor"), false);
  assert.equal(el.isAllowed("regular", "stranger"), false);
});

test("page wires the core and keeps the original user buttons", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "demo/free-for-whom.html"), "utf8");
  assert.match(html, /src="\.\.\/src\/lib\/eligibility\.js"/);
  for (const u of ["visitor", "reserved", "ev", "accessible"]) assert.match(html, new RegExp('data-user="' + u + '"'));
  assert.match(html, /id="msg"/);
  assert.match(html, /id="stamp"/);
  assert.match(html, /אין שמירת מקום/);
});
