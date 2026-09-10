// ParkWiz — time-decayed availability score from community reports.
//
// A report's weight halves every 15 minutes; reports older than 2 hours are
// dropped entirely rather than decayed to a negligible value, so a stale burst
// of reports can never accumulate into a signal.
//
// `reports` is an array of { ts: epochMs, delta: number }. Positive delta means
// "a spot opened up", negative means "a spot was taken".
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const HALF_LIFE_MS = 15 * 60 * 1000;
  const MAX_AGE_MS = 2 * 60 * 60 * 1000;

  function weightedAvailability(reports, nowMs, validate = false) {
    if (validate && reports.some((report) => report.ts > nowMs)) {
      throw new RangeError('Report timestamp cannot be in the future');
    }
    const cutoff = nowMs - MAX_AGE_MS;
    return reports.reduce(
      (sum, r) => (r.ts >= cutoff ? sum + r.delta * Math.pow(0.5, (nowMs - r.ts) / HALF_LIFE_MS) : sum),
      0
    );
  }

  // bucketedAvailability - the same score as weightedAvailability, split into
  // fixed backward-looking windows, so a municipal reader sees the shape of the
  // last two hours instead of one number.
  //
  // Bucket i covers ages [i * bucket, (i + 1) * bucket) counted back from
  // nowMs; bucket 0 ends at nowMs. There are ceil(MAX_AGE_MS / bucket) buckets,
  // and the oldest one absorbs the exact MAX_AGE_MS boundary so that a report
  // weightedAvailability still counts is never silently dropped here. Its
  // startMs is clamped to nowMs - MAX_AGE_MS, so a bucket size that does not
  // divide two hours produces a short last window rather than a fake one.
  //
  // Weighting is weightedAvailability's, unchanged: delta * 0.5^(age /
  // HALF_LIFE_MS), nothing older than MAX_AGE_MS. A report newer than nowMs
  // lands in bucket 0 and keeps the (greater than 1) weight
  // weightedAvailability would give it - this function reproduces that
  // function, it does not invent a policy of its own. A caller who rejects the
  // future should call weightedAvailability(reports, nowMs, true) first.
  // A report with a non-finite ts or delta is skipped instead of poisoning the
  // whole table with NaN.
  //
  // The invariant, asserted in test/availability-bucket.test.js:
  //   sum of bucket.score === weightedAvailability(reports, nowMs)
  //
  // Pure: no Date, no Math.random, no network.
  function bucketedAvailability(reports, nowMs, bucketMinutes) {
    const minutes = Number(bucketMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      throw new RangeError('bucketMinutes must be a positive number');
    }
    const bucketMs = minutes * 60 * 1000;
    const count = Math.ceil(MAX_AGE_MS / bucketMs);
    const cutoff = nowMs - MAX_AGE_MS;
    const buckets = [];
    for (let i = 0; i < count; i++) {
      buckets.push({
        index: i,
        startMs: Math.max(cutoff, nowMs - (i + 1) * bucketMs),
        endMs: nowMs - i * bucketMs,
        count: 0,
        score: 0,
      });
    }
    (Array.isArray(reports) ? reports : []).forEach((r) => {
      if (!r || !Number.isFinite(r.ts) || !Number.isFinite(r.delta)) return;
      if (r.ts < cutoff) return;
      const age = nowMs - r.ts;
      const i = Math.min(count - 1, Math.max(0, Math.floor(age / bucketMs)));
      buckets[i].count += 1;
      buckets[i].score += r.delta * Math.pow(0.5, age / HALF_LIFE_MS);
    });
    return buckets;
  }

  return { weightedAvailability, bucketedAvailability, HALF_LIFE_MS, MAX_AGE_MS };
});
