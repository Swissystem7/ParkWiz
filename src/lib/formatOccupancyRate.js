function formatOccupancyRate(occupied, total) {
  if (typeof occupied !== 'number' || !Number.isFinite(occupied) ||
      typeof total !== 'number' || !Number.isFinite(total) || total <= 0) {
    return '0.0%';
  }

  const rate = Math.max(0, Math.min(100, occupied / total * 100));
  return rate.toFixed(1) + '%';
}

module.exports = { formatOccupancyRate };
