function isValidBeaconId(id) {
	if (typeof id !== "string") return false;
	const m = /^(\d+)-(\d+)$/.exec(id);
	if (!m) return false;
	const major = Number(m[1]);
	const minor = Number(m[2]);
	return (
		Number.isInteger(major) &&
		Number.isInteger(minor) &&
		major >= 1 &&
		major <= 65535 &&
		minor >= 1 &&
		minor <= 65535
	);
}

module.exports = { isValidBeaconId };
