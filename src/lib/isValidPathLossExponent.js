function isValidPathLossExponent(n) {
	return typeof n === "number" && Number.isFinite(n) && n >= 2.0 && n <= 5.0;
}
module.exports = { isValidPathLossExponent };
// round-17 CI recover 20261109-203016
