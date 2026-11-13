function formatStallLabel(stallId, customName = null) {
	if (typeof stallId !== "string" || !stallId.trim()) return "";
	const id = stallId.trim().toUpperCase();
	if (typeof customName === "string" && customName.trim()) {
		return `${id} (${customName.trim()})`;
	}
	return id;
}
module.exports = { formatStallLabel };
