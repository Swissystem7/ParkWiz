// ParkWiz — CSV/JSON export and a hash-encoded read-only summary.
//
// The repo has no server. A municipal reviewer needs to take numbers out of
// a student's browser and forward a snapshot that cannot be edited in place.
(function (root, factory) {
  const compare = (typeof module === 'object' && module.exports)
    ? require('./compare')
    : root.ParkWizCompare;
  const api = factory(compare);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizExport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (compare) {
  function csvEscape(value) {
    const s = value == null ? '' : String(value);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCsv(header, rows) {
    const lines = [header.join(',')];
    rows.forEach((row) => {
      lines.push(header.map((key) => csvEscape(row[key])).join(','));
    });
    return lines.join('\n');
  }

  function occupancyToCsv(records) {
    return toCsv(
      ['ts', 'street', 'total', 'occupied', 'source', 'confidence'],
      Array.isArray(records) ? records : []
    );
  }

  function pairsToCsv(pairs) {
    return toCsv(
      ['ts', 'street', 'total', 'systemOccupied', 'manualOccupied', 'accuracy', 'note', 'source'],
      Array.isArray(pairs) ? pairs : []
    );
  }

  function buildPilotPacket(input) {
    const occupancy = Array.isArray(input && input.occupancy) ? input.occupancy : [];
    const pairs = Array.isArray(input && input.pairs) ? input.pairs : [];
    const summary = compare.summarizePairs(pairs);
    return {
      version: 1,
      kind: 'parkwiz-pilot-packet',
      generatedAt: (input && input.generatedAt) || new Date().toISOString(),
      street: (input && input.street) || (pairs[0] && pairs[0].street) || (occupancy[0] && occupancy[0].street) || '—',
      note: 'חבילת מדידה מקומית מהדפדפן. אין מצלמה חיה ואין זיהוי לוחיות.',
      occupancy,
      pairs,
      summary,
    };
  }

  function toUrlB64(str) {
    const raw = (typeof Buffer !== 'undefined')
      ? Buffer.from(str, 'utf8').toString('base64')
      : btoa(unescape(encodeURIComponent(str)));
    return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function fromUrlB64(b64) {
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const raw = String(b64).replace(/-/g, '+').replace(/_/g, '/') + pad;
    if (typeof Buffer !== 'undefined') return Buffer.from(raw, 'base64').toString('utf8');
    return decodeURIComponent(escape(atob(raw)));
  }

  function encodeSharePayload(packet) {
    const summary = (packet && packet.summary) || compare.summarizePairs((packet && packet.pairs) || []);
    const pairs = (packet && packet.pairs) || [];
    const last = pairs.length ? pairs[pairs.length - 1] : null;
    const slim = {
      v: 1,
      s: (packet && packet.street) || '',
      n: summary.count,
      a: summary.meanAccuracy,
      i: summary.minAccuracy,
      x: summary.maxAccuracy,
      e: summary.meanAbsError,
      p: summary.perfect,
      f: pairs[0] ? pairs[0].ts : '',
      t: last ? last.ts : '',
      ls: last ? last.systemOccupied : null,
      lm: last ? last.manualOccupied : null,
      lt: last ? last.total : null,
      g: (packet && packet.generatedAt) || new Date().toISOString(),
      d: summary.sampleOnly ? 1 : 0,
    };
    return toUrlB64(JSON.stringify(slim));
  }

  function decodeSharePayload(token) {
    if (!token || typeof token !== 'string') return null;
    let slim;
    try { slim = JSON.parse(fromUrlB64(token.trim())); } catch (e) { return null; }
    if (!slim || slim.v !== 1 || !Number.isFinite(Number(slim.n))) return null;
    const n = Number(slim.n);
    const numOrNull = (v) => (v == null || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null));
    return {
      version: 1,
      street: slim.s != null ? String(slim.s) : '—',
      count: n,
      meanAccuracy: numOrNull(slim.a),
      minAccuracy: numOrNull(slim.i),
      maxAccuracy: numOrNull(slim.x),
      meanAbsError: numOrNull(slim.e),
      perfect: Number.isFinite(Number(slim.p)) ? Number(slim.p) : 0,
      firstTs: slim.f ? String(slim.f) : '',
      lastTs: slim.t ? String(slim.t) : '',
      lastSystem: numOrNull(slim.ls),
      lastManual: numOrNull(slim.lm),
      lastTotal: numOrNull(slim.lt),
      generatedAt: slim.g ? String(slim.g) : '',
      sampleOnly: slim.d === 1,
    };
  }

  return {
    csvEscape,
    occupancyToCsv,
    pairsToCsv,
    buildPilotPacket,
    encodeSharePayload,
    decodeSharePayload,
    toUrlB64,
    fromUrlB64,
  };
});
