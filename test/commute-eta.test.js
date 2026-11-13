const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { formatEtaMinutes } = require("../src/lib/formatEtaMinutes.js");

const html = fs.readFileSync(
	path.join(__dirname, "..", "demo", "commute.html"),
	"utf8",
);

test("commute.html loads formatEtaMinutes script", () => {
	assert.match(html, /formatEtaMinutes\.js/);
});

test("ETA element has id and aria-label", () => {
	assert.match(html, /id="commuteEtaText"/);
	assert.match(html, /aria-label="זמן הגעה משוער/);
});

test("formatEtaMinutes returns Hebrew for 20m, 150m, 400m", () => {
	assert.equal(formatEtaMinutes(20, 10), "< דקה");
	assert.match(formatEtaMinutes(150, 10), /דק/);
	assert.match(formatEtaMinutes(400, 10), /דק/);
});
