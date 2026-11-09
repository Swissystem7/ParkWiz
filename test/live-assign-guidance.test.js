const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
	formatDriverGuidance,
} = require("../src/lib/formatDriverGuidance.js");

const html = fs.readFileSync(
	path.join(__dirname, "..", "live-assign.html"),
	"utf8",
);

test("live-assign.html loads formatDriverGuidance script", () => {
	assert.match(html, /src\/lib\/formatDriverGuidance\.js/);
});

test("guidance element has role=status and aria-live=polite", () => {
	assert.match(html, /id="driverGuidanceText"/);
	assert.match(html, /aria-live="polite"/);
	assert.match(html, /role="status"/);
});

test("formatDriverGuidance returns Hebrew with translated zone colors", () => {
	const s = formatDriverGuidance("A-04", -1, "Blue");
	assert.match(s, /מפלס/);
	assert.match(s, /כחול/);
	assert.match(s, /A-04/);
});

test("empty spot id returns safe default Hebrew guidance", () => {
	assert.equal(
		formatDriverGuidance(""),
		"עקוב אחר שילוט החניון הפנוי",
	);
});
