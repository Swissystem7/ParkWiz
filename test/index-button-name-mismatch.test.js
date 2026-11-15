// axe rule "label-content-name-mismatch" (WCAG 2.5.3 Label in Name):
// Elements labelled through their content must have their visible text as part of their accessible name.
// For interactive buttons with visible text, the text (or alphanumeric tokens) must be present in aria-label.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const NON_LETTER_OR_NUMBER = /[^\p{L}\p{N}]+/gu;

function curateTokens(str) {
	const text = (str || "")
		.normalize("NFKD")
		.replace(/\([^()]*\)/g, "")
		.replace(NON_LETTER_OR_NUMBER, " ")
		.trim();
	if (text.length === 0) return [];
	return text.split(/\s+/).filter(Boolean);
}

function isContiguousSubsequence(nameTokens, labelTokens) {
	if (labelTokens.length === 0) return true;
	if (labelTokens.length > nameTokens.length) return false;
	for (let i = 0; i <= nameTokens.length - labelTokens.length; i++) {
		let match = true;
		for (let j = 0; j < labelTokens.length; j++) {
			if (nameTokens[i + j].toLowerCase() !== labelTokens[j].toLowerCase()) {
				match = false;
				break;
			}
		}
		if (match) return true;
	}
	return false;
}

function hasMatchingLabel(attrs, innerHtml) {
	const ariaLabelMatch = attrs.match(/aria-label="([^"]+)"/);
	if (!ariaLabelMatch) return true;
	const visibleText = innerHtml.replace(/<[^>]+>/g, " ").trim();
	const vTokens = curateTokens(visibleText);
	const aTokens = curateTokens(ariaLabelMatch[1]);
	return isContiguousSubsequence(aTokens, vTokens);
}

test("btnDismissHero includes visible text in aria-label (WCAG 2.5.3)", () => {
	const match = html.match(
		/<button[^>]*id="btnDismissHero"[^>]*>([\s\S]*?)<\/button>/i,
	);
	assert.ok(match, "btnDismissHero button exists in index.html");
	const ariaLabelMatch = match[0].match(/aria-label="([^"]+)"/);
	assert.ok(ariaLabelMatch, "btnDismissHero must have aria-label");
	assert.match(ariaLabelMatch[1], /מעבר למפה/);
});

test("tlvBtn includes visible text in aria-label (WCAG 2.5.3)", () => {
	const match = html.match(
		/<button[^>]*id="tlvBtn"[^>]*>([\s\S]*?)<\/button>/i,
	);
	assert.ok(match, "tlvBtn button exists in index.html");
	const ariaLabelMatch = match[0].match(/aria-label="([^"]+)"/);
	assert.ok(ariaLabelMatch, "tlvBtn must have aria-label");
	assert.match(ariaLabelMatch[1], /מגרשי חניה נתניה/);
});

test("consumer demo buttons include visible text in aria-label", () => {
	assert.match(
		html,
		/<button class="btn btn-ghost" data-consumer-demo[^>]*aria-label="DEMO[^"]*">DEMO<\/button>/,
	);
	assert.match(
		html,
		/<button class="premium-btn" data-consumer-demo[^>]*aria-label="ParkWiz Premium[^"]*">ParkWiz Premium ⚡<\/button>/,
	);
});

test("pwFbCloseBtn includes visible text in aria-label", () => {
	assert.match(
		html,
		/id="pwFbCloseBtn"[^>]*aria-label="ביטול[^"]*"[^>]*>ביטול<\/button>/,
	);
});

test("every button in index.html with aria-label has its visible text contained in its accessible name", () => {
	const buttonMatches = [
		...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi),
	];
	assert.ok(
		buttonMatches.length >= 20,
		`expected buttons in index.html, found ${buttonMatches.length}`,
	);

	const mismatches = buttonMatches.filter((b) => !hasMatchingLabel(b[1], b[2]));
	assert.deepEqual(
		mismatches,
		[],
		`Buttons failing label-content-name-mismatch: ${JSON.stringify(mismatches)}`,
	);
});

test("token matcher catches label-content-name-mismatches and accepts matching labels", () => {
	const visible = "מעבר למפה ✕";
	const badLabel = "סגור דף פתיחה ועבור למפה";
	const goodLabel = "מעבר למפה — סגור דף פתיחה ועבור למפה";

	assert.equal(
		isContiguousSubsequence(curateTokens(badLabel), curateTokens(visible)),
		false,
	);
	assert.equal(
		isContiguousSubsequence(curateTokens(goodLabel), curateTokens(visible)),
		true,
	);

	const tlvVisible = "🏛 מגרשי חניה נתניה · מיקום בלבד";
	const badTlv = "הצג או הסתר מגרשי חניה עירוניים — מיקום בלבד";
	const goodTlv =
		"מגרשי חניה נתניה · מיקום בלבד — הצג או הסתר מגרשי חניה עירוניים";

	assert.equal(
		isContiguousSubsequence(curateTokens(badTlv), curateTokens(tlvVisible)),
		false,
	);
	assert.equal(
		isContiguousSubsequence(curateTokens(goodTlv), curateTokens(tlvVisible)),
		true,
	);

	// Edge cases: empty tokens, labelTokens longer than nameTokens
	assert.equal(isContiguousSubsequence(["short"], ["longer", "label"]), false);
	assert.equal(isContiguousSubsequence(["any"], []), true);
	assert.deepEqual(curateTokens(""), []);
	assert.deepEqual(curateTokens(null), []);

	// hasMatchingLabel edge cases:
	assert.equal(hasMatchingLabel('class="btn"', "סתם כפתור"), true);
	assert.equal(
		hasMatchingLabel('aria-label="לא מתאים"', "כפתור אחר לגמרי"),
		false,
	);
});
