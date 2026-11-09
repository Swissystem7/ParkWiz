function isValidPathLossExponent(n) {
	return typeof n === "number" && Number.isFinite(n) && n >= 2.0 && n <= 5.0;
}
module.exports = { isValidPathLossExponent };
