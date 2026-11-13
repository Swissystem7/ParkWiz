const { filterStallsByAisle } = require("./filterStallsByAisle");

function computeAisleCapacity(stalls, targetAisle) {
	const aisleLabel =
		typeof targetAisle === "string"
			? targetAisle.trim().toUpperCase()
			: String(targetAisle || "");
	if (
		!Array.isArray(stalls) ||
		typeof targetAisle !== "string" ||
		targetAisle.trim() === ""
	) {
		return {
			aisle: aisleLabel,
			total: 0,
			free: 0,
			occupied: 0,
			unknown: 0,
			isFull: true,
		};
	}
	const aisle = targetAisle.trim().toUpperCase();
	const matched = filterStallsByAisle(stalls, aisle);
	let free = 0;
	let occupied = 0;
	let unknown = 0;
	for (const stall of matched) {
		const status =
			typeof stall?.status === "string"
				? stall.status.toLowerCase()
				: "unknown";
		if (status === "free") free += 1;
		else if (status === "occupied") occupied += 1;
		else unknown += 1;
	}
	const total = matched.length;
	return {
		aisle,
		total,
		free,
		occupied,
		unknown,
		isFull: free === 0 && total > 0,
	};
}

module.exports = { computeAisleCapacity };
