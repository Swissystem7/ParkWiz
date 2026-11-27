// axe rule "aria-allowed-attr" (WCAG 4.1.2 Name, Role, Value):
// Elements must only use supported ARIA attributes for their role.
// Inputs with aria-expanded must expose role="combobox" (or another role that supports aria-expanded),
// because default text inputs (role="textbox") do not allow aria-expanded.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test('searchInput has role="combobox" to support aria-expanded and aria-controls (axe: aria-allowed-attr)', () => {
	const match = html.match(/<input\b[^>]*id="searchInput"[^>]*>/i);
	assert.ok(match, "expected to find #searchInput input in index.html");
	const tag = match[0];
	assert.match(
		tag,
		/\brole="combobox"/,
		'#searchInput must declare role="combobox" to allow aria-expanded',
	);
	assert.match(
		tag,
		/\baria-expanded="(false|true)"/,
		"#searchInput must declare aria-expanded",
	);
	assert.match(
		tag,
		/\baria-controls="autocomplete"/,
		"#searchInput must control #autocomplete",
	);
	assert.match(
		tag,
		/\baria-autocomplete="list"/,
		"#searchInput must declare aria-autocomplete",
	);
	assert.match(
		tag,
		/\baria-label=/,
		"#searchInput must have an accessible name",
	);
});

test("elements with aria-expanded in index.html use roles that support it", () => {
	// WAI-ARIA 1.2: aria-expanded is supported on button, combobox, document, link, menuitem,
	// row, rowheader, tab, treeitem (and application/summary natively).
	// Plain inputs without a role default to role="textbox", which does NOT allow aria-expanded.
	const ROLES_SUPPORTING_ARIA_EXPANDED = new Set([
		"button",
		"combobox",
		"document",
		"link",
		"menuitem",
		"row",
		"rowheader",
		"tab",
		"treeitem",
	]);

	const tagRegex = /<([a-z0-9-]+)([^>]*\baria-expanded="[^"]*"[^>]*)>/gi;
	const disallowed = [];

	for (const match of html.matchAll(tagRegex)) {
		const tagName = match[1].toLowerCase();
		const attrs = match[2];
		const roleMatch = attrs.match(/\brole="([^"]+)"/i);
		let role = "textbox";
		if (roleMatch) {
			role = roleMatch[1].toLowerCase();
		} else if (tagName === "button" || tagName === "summary") {
			role = tagName;
		}

		const isSupported =
			tagName === "button" ||
			tagName === "summary" ||
			ROLES_SUPPORTING_ARIA_EXPANDED.has(role);

		if (!isSupported) {
			disallowed.push(`<${tagName} ${attrs.trim()}> (computed role: ${role})`);
		}
	}

	assert.deepEqual(
		disallowed,
		[],
		`Found elements with aria-expanded not supported by their role: ${disallowed.join("; ")}`,
	);
});
