// B2G-PAR-3: aggregate raw parking records into anonymized location/time-bin counts.
// Strips plate identifiers; returns only counts per (location, time-bin). Software-only,
// tender-defensible privacy posture for the municipal (B2G) data model.
// ponytail: no k-anonymity suppression — bins with count<k can still re-identify a lone
// vehicle. Contract returns all counts; add a `minCount` suppression param if procurement
// requires k-anonymity (see B2G-PAR-4 follow-up).
function aggregateAnonymizedData(rawRecords, windowHours) {
  if (windowHours <= 0) throw new Error("windowHours must be positive");
  if (!rawRecords || rawRecords.length === 0) return [];
  const bins = {};
  const binMs = windowHours * 3600000;
  for (const rec of rawRecords) {
    const epoch = new Date(rec.timestamp).getTime();
    const binStart = new Date(Math.floor(epoch / binMs) * binMs).toISOString();
    const key = rec.location + "|" + binStart;
    if (!bins[key]) bins[key] = { location: rec.location, timeBinStart: binStart, count: 0 };
    bins[key].count++;
  }
  return Object.values(bins);
}
module.exports = { aggregateAnonymizedData };
