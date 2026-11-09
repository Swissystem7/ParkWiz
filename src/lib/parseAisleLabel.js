function parseAisleLabel(labelStr) {
	if (typeof labelStr !== "string" || labelStr.trim() === "") {
		return null;
	}

	const parts = labelStr.split("/");
	if (parts.length !== 3) {
		return null;
	}

	const level = parseLevelPart(parts[0]);
	const zone = parseZonePart(parts[1]);
	const row = parseRowPart(parts[2]);
	if (level === null || zone === null || row === null) {
		return null;
	}

	return { level, zone, row };
}

function parseLevelPart(part) {
	const text = part.trim();
	const keywordMatch = text.match(/^(?:floor|level)\s*/i);
	const levelText = keywordMatch
		? text.slice(keywordMatch[0].length).trim()
		: text;

	let level = null;
	if (/^-?\d+$/.test(levelText)) {
		level = Number(levelText);
	} else if (/^\d+-$/.test(levelText)) {
		level = Number(`-${levelText.slice(0, -1)}`);
	}

	if (level === null || !Number.isFinite(level) || !Number.isInteger(level)) {
		return null;
	}

	return level === 0 ? 0 : level;
}

function parseZonePart(part) {
	const collapsed = part.trim().replace(/\s+/g, " ");
	if (collapsed === "" || /^zone$/i.test(collapsed)) {
		return null;
	}

	const zone = collapsed.replace(/ zone$/i, "");
	return zone === "" ? null : zone;
}

function parseRowPart(part) {
	const match = part.trim().match(/^(?:row\s*)?([a-z])$/i);
	if (!match || !/^[A-Za-z]$/.test(match[1])) {
		return null;
	}

	return match[1].toUpperCase();
}

module.exports = { parseAisleLabel };
