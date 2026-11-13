function buildBreadcrumbPath(startId, targetId, graph) {
	if (typeof graph !== "object" || graph === null || Array.isArray(graph)) {
		return null;
	}

	if (
		typeof startId !== "string" ||
		typeof targetId !== "string" ||
		!Object.hasOwn(graph, startId) ||
		!Object.hasOwn(graph, targetId)
	) {
		return null;
	}

	if (startId === targetId) {
		return [startId];
	}

	const queue = [[startId]];
	const visited = new Set([startId]);

	while (queue.length > 0) {
		const currentPath = queue.shift();
		const currentId = currentPath[currentPath.length - 1];

		const rawNeighbours =
			Object.hasOwn(graph, currentId) && Array.isArray(graph[currentId])
				? graph[currentId]
				: [];

		for (const neighbour of rawNeighbours) {
			if (typeof neighbour !== "string") {
				continue;
			}
			if (visited.has(neighbour)) {
				continue;
			}

			const nextPath = [...currentPath, neighbour];
			if (neighbour === targetId) {
				return nextPath;
			}

			visited.add(neighbour);
			queue.push(nextPath);
		}
	}

	return null;
}

module.exports = { buildBreadcrumbPath };
