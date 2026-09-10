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
  // The most windows a two-hour table may be cut into: 240, i.e. a floor of
  // 30 seconds per bucket. A municipal reader is looking at the shape of the
  // last two hours, and no reading of that needs a finer grain than half a
  // minute. Without a cap the bucket count is 1 / bucketMinutes unbounded:
  // bucketMinutes 0.01 allocates 12,000 bucket objects and 0.001 allocates
  // 120,000, both measured, from one mistyped argument.
  const MAX_BUCKETS = 240;
  const MIN_BUCKET_MINUTES = MAX_AGE_MS / MAX_BUCKETS / (60 * 1000);

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
  // nowMs; bucket 0 ends at nowMs. bucketMinutes must be a positive number of
  // at least MIN_BUCKET_MINUTES (0.5, i.e. 30 seconds), so that the table can
  // never be more than MAX_BUCKETS windows long; anything smaller is a
  // programmer error and throws rather than allocating. There are
  // ceil(MAX_AGE_MS / bucket) buckets,
  // and the oldest one absorbs the exact MAX_AGE_MS boundary so that a report
  // weightedAvailability still counts is never silently dropped here. Its
  // startMs is clamped to nowMs - MAX_AGE_MS, so a bucket size that does not
  // divide two hours produces a short last window rather than a fake one.
  //
  // The weighting is not written down here at all. Each report's contribution
  // is whatever weightedAvailability([report], nowMs) says it is, asked one
  // report at a time, so exactly one place in this module decides what a
  // report is worth and this table follows it by construction.
  //
  // That matters for a case two open branches disagree about. Here a report
  // newer than nowMs is worth 0.5^-1 = 2; PR #49, on
  // release/candidate-2026-09-10, rewrote weightedAvailability so a future
  // report is worth 0 unless validate throws first. A second copy of the
  // formula in this function would have made the bucket table contradict the
  // score it claims to break down, and the merge would have had to pick a
  // winner. Delegating means whichever policy weightedAvailability ends up
  // with is the policy of the buckets too. A caller who rejects the future
  // should still call weightedAvailability(reports, nowMs, true) first.
  //
  // A report with a non-finite ts or delta is skipped instead of poisoning the
  // whole table with NaN, and one older than MAX_AGE_MS is skipped rather than
  // filed at weight 0, so bucket.count keeps meaning what it says.
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
    if (minutes < MIN_BUCKET_MINUTES) {
      throw new RangeError('bucketMinutes must be at least ' + MIN_BUCKET_MINUTES
        + ' (at most ' + MAX_BUCKETS + ' buckets)');
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
      buckets[i].score += weightedAvailability([r], nowMs);
    });
    return buckets;
  }

  return {
    weightedAvailability,
    bucketedAvailability,
    HALF_LIFE_MS,
    MAX_AGE_MS,
    MAX_BUCKETS,
    MIN_BUCKET_MINUTES,
  };
});
