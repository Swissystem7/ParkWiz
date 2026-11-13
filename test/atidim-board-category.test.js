const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
	categorizeOccupancyLevel,
} = require("../src/lib/categorizeOccupancyLevel.js");

const html = fs.readFileSync(
	path.join(__dirname, "..", "demo", "atidim-board.html"),
	"utf8",
);

test("atidim-board loads categorizeOccupancyLevel and badge", () => {
	assert.match(html, /categorizeOccupancyLevel\.js/);
	assert.match(html, /id="occupancyCategoryBadge"/);
	assert.match(html, /aria-live="polite"/);
	assert.match(html, /role="status"/);
});

test("categorizeOccupancyLevel maps 10/60/85/99 percent", () => {
	assert.equal(categorizeOccupancyLevel(10), "low");
	assert.equal(categorizeOccupancyLevel(60), "medium");
	assert.equal(categorizeOccupancyLevel(85), "high");
	assert.equal(categorizeOccupancyLevel(99), "full");
});

test("badge label mapping follows explicit low/medium/high/full Hebrew", () => {
	assert.match(html, /עומס נמוך/);
	assert.match(html, /עומס בינוני/);
	assert.match(html, /עומס כבד/);
	assert.match(html, /חניון מלא/);
	// default initial text per markup
	assert.match(html, />פנוי</);
});
