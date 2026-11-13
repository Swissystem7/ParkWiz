function isStallOccupied(stall) {
	if (!stall || typeof stall !== "object" || Array.isArray(stall)) return false;
	if (stall.occupied === true) return true;
	const status =
		typeof stall.status === "string" ? stall.status.trim().toLowerCase() : "";
	if (status === "occupied") return true;
	const state =
		typeof stall.state === "string" ? stall.state.trim().toLowerCase() : "";
	if (state === "occupied") return true;
	return false;
}
module.exports = { isStallOccupied };
