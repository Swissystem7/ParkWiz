function truncateLogMessage(message, maxLen = 120) {
	if (typeof message !== "string") return "";
	const trimmed = message.trim();
	if (!Number.isFinite(maxLen)) maxLen = 120;
	if (maxLen <= 3) return trimmed.slice(0, Math.max(0, maxLen));
	if (trimmed.length <= maxLen) return trimmed;
	return trimmed.slice(0, maxLen - 3) + "...";
}
module.exports = { truncateLogMessage };
