const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const calc = require("../src/lib/results-calc.js");

test("no result before all three numbers are entered", () => {
  for (const input of [{}, { checked: "", correct: "", missed: "" }, { checked: 10, correct: 9 }]) {
    const r = calc.alerts(input);
    assert.equal(r.ok, false);
    assert.match(r.textHe, /אין תוצאה/);
    assert.equal(r.precision, undefined);
  }
});

test("invalid input is rejected without a number", () => {
  for (const input of [{ checked: 0, correct: 0, missed: 0 }, { checked: 5, correct: 6, missed: 0 }, { checked: -1, correct: 0, missed: 0 }, { checked: 2.5, correct: 1, missed: 0 }]) {
    assert.equal(calc.alerts(input).ok, false);
  }
});

test("precision, recall and shown-free-but-taken from the counts", () => {
  const r = calc.alerts({ checked: "200", correct: "197", missed: "13" });
  assert.equal(r.ok, true);
  assert.equal(r.precision, 98.5);
  assert.equal(r.recall, 93.8);
  assert.equal(r.falseFree, 3);
  assert.equal(r.meetsPrecision, true);
  assert.equal(r.meetsRecall, true);
});

test("below the proposed targets is reported as not met", () => {
  const r = calc.alerts({ checked: 100, correct: 90, missed: 30 });
  assert.equal(r.precision, 90);
  assert.equal(r.recall, 75);
  assert.equal(r.meetsPrecision, false);
  assert.equal(r.meetsRecall, false);
  assert.deepEqual(calc.TARGETS, { precision: 98, recall: 90 });
});

test("calculator and trial card pages are wired", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "demo/results-calculator.html"), "utf8");
  assert.match(html, /src="\.\.\/src\/lib\/results-calc\.js"/);
  for (const id of ["aChecked", "aCorrect", "aMissed", "aCalc", "aOut", "total", "agree", "calc", "out"]) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(html, /יעד פתיחה מוצע/);
  const card = fs.readFileSync(path.join(__dirname, "..", "demo/trial-card.html"), "utf8");
  for (const name of ["site", "area", "problem", "scope", "contacts", "metrics", "stop"]) assert.match(card, new RegExp('name="' + name + '"'));
});
