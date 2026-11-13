((root, factory) => {
	const api = factory();
	if (typeof module === "object" && module.exports) module.exports = api;
	root.isOlderThanSeconds = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
	return (ts, maxAgeSec, now = Date.now()) => {
		if (
			!Number.isFinite(ts) ||
			ts > now ||
			!Number.isFinite(maxAgeSec) ||
			maxAgeSec <= 0
		) {
			return true;
		}
		return now - ts > maxAgeSec * 1000;
	};
});
