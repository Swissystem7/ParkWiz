function isPlainObject(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}
	const proto = Object.getPrototypeOf(value);
	return proto === null || proto === Object.prototype;
}

function isNonNegativeInteger(value) {
	return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseBlePayload(packet) {
	if (!isPlainObject(packet)) {
		return null;
	}

	const { major, minor } = packet;
	if (!isNonNegativeInteger(major) || !isNonNegativeInteger(minor)) {
		return null;
	}

	const beaconId = `${major}-${minor}`;
	const floorLevel = major >= 100 ? -(major - 100) || 0 : major;
	const zoneLetter =
		minor >= 65 && minor <= 90 ? String.fromCharCode(minor) : "GENERAL";

	return {
		beaconId,
		floorLevel,
		zoneLetter,
		rssi: Number(packet.rssi) || -100,
		txPower: Number(packet.txPower) || -59,
	};
}

module.exports = { parseBlePayload };
