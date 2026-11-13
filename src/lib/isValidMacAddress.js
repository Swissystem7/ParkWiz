function isValidMacAddress(macStr) {
	if (typeof macStr !== "string") {
		return false;
	}
	const s = macStr.trim();
	return /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(s);
}

module.exports = { isValidMacAddress };
