function isValidTransmissionPower(txPower) {
	return (
		typeof txPower === "number" &&
		Number.isFinite(txPower) &&
		txPower >= -100 &&
		txPower <= -40
	);
}
module.exports = { isValidTransmissionPower };
