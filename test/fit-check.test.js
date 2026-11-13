const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const fit = require("../src/lib/fit-check.js");

test("with no answers every digest item is on the to-clarify list", () => {
  const r = fit.toClarify({});
  assert.equal(r.items.length, fit.QUESTIONS.length);
  assert.equal(fit.QUESTIONS.length, 9);
  assert.match(r.directionHe, /לברר עם IT/);
});

test("'no' and 'unknown' stay on the list, only 'yes' is removed", () => {
  const answers = {};
  for (const q of fit.QUESTIONS) answers[q.id] = "yes";
  answers.eligibility = "no";
  answers.privacy = "unknown";
  const r = fit.toClarify(answers, "install");
  assert.deepEqual(r.items, [fit.QUESTIONS[5].todoHe, fit.QUESTIONS[6].todoHe]);
  assert.match(r.items[0], /פנוי/);
  assert.match(r.directionHe, /אין צורך להתקין/);
});

test("each IT limit gives its own direction and none gives a score", () => {
  const seen = new Set();
  for (const k of Object.keys(fit.LIMITS)) {
    const r = fit.toClarify({}, k);
    seen.add(r.directionHe);
    assert.match(r.noteHe, /אין ציון/);
    assert.equal(Object.keys(r).includes("score"), false);
  }
  assert.equal(seen.size, Object.keys(fit.LIMITS).length);
});

test("meeting-ops page wires the fit check and keeps the original fields", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "demo/meeting-ops.html"), "utf8");
  assert.match(html, /src="\.\.\/src\/lib\/fit-check\.js"/);
  for (const id of ["camType", "zone", "compatBtn", "compatOut", "fitQs", "fitLimit", "fitList"]) assert.match(html, new RegExp('id="' + id + '"'));
});
