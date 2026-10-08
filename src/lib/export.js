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
  // A cell that starts with = + - @ or a tab/CR is executed as a formula by
  // Excel, LibreOffice and Google Sheets when the CSV is opened. Free-text
  // fields here (note, street, lighting) come straight from a field worker's
  // keyboard, and the reviewer who opens the file is a different person.
  // Real numbers (-5, 0.45) are left alone: only text that merely begins with
  // a trigger character gets a leading apostrophe, which spreadsheets show as
  // plain text.
  const FORMULA_LEAD = /^[=+\-@\t\r]/;

  // The files are opened in Excel on a municipal Windows PC. Without a UTF-8
  // byte-order mark Excel decodes a .csv in the machine's ANSI code page, so
  // every Hebrew street name, lighting label and inspector note turns into
  // gibberish. The mark is invisible in every other spreadsheet and editor.
  const CSV_BOM = '\uFEFF';
  const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

  function neutralizeFormula(s) {
    if (typeof s !== 'string' || !FORMULA_LEAD.test(s) || PLAIN_NUMBER.test(s)) return s;
    return "'" + s;
  }

  function csvEscape(value) {
    const s = value == null ? '' : neutralizeFormula(String(value));
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCsv(header, rows) {
    const lines = [header.join(',')];
    rows.forEach((row) => {
      lines.push(header.map((key) => csvEscape(row[key])).join(','));
    });
    return CSV_BOM + lines.join('\n');
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

  function logToCsv(days) {
    return toCsv(
      ['day', 'date', 'lighting', 'total', 'systemOccupied', 'manualOccupied', 'note', 'source'],
      Array.isArray(days) ? days : []
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
    // Validate that 'n' is a non-negative integer
    if (n < 0 || n !== Math.floor(n)) return null;
    const numOrNull = (v) => (v == null || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null));

    // The hash is forgeable: anyone can edit the token by hand and the summary
    // page would print whatever came out. Every figure the page shows must
    // stay inside the domain the encoder can produce: accuracies in 0..1,
    // non-negative error, perfect <= count, last counts within last total.
    // A token outside those bounds is reported as corrupt, not rendered.
    const meanAccuracy = numOrNull(slim.a);
    const minAccuracy = numOrNull(slim.i);
    const maxAccuracy = numOrNull(slim.x);
    const meanAbsError = numOrNull(slim.e);
    const perfect = slim.p == null || slim.p === '' ? 0 : numOrNull(slim.p);
    const lastSystem = numOrNull(slim.ls);
    const lastManual = numOrNull(slim.lm);
    const lastTotal = numOrNull(slim.lt);

    const inUnit = (v) => v == null || (v >= 0 && v <= 1);
    if (!inUnit(meanAccuracy) || !inUnit(minAccuracy) || !inUnit(maxAccuracy)) return null;
    if (minAccuracy != null && maxAccuracy != null && minAccuracy > maxAccuracy) return null;
    if (meanAbsError != null && meanAbsError < 0) return null;
    if (perfect == null || perfect < 0 || perfect !== Math.floor(perfect) || perfect > n) return null;
    if (lastTotal != null && lastTotal < 0) return null;
    const inTotal = (v) => v == null || (v >= 0 && (lastTotal == null || v <= lastTotal));
    if (!inTotal(lastSystem) || !inTotal(lastManual)) return null;

    return {
      version: 1,
      street: slim.s != null ? String(slim.s) : '—',
      count: n,
      meanAccuracy,
      minAccuracy,
      maxAccuracy,
      meanAbsError,
      perfect,
      firstTs: slim.f ? String(slim.f) : '',
      lastTs: slim.t ? String(slim.t) : '',
      lastSystem,
      lastManual,
      lastTotal,
      generatedAt: slim.g ? String(slim.g) : '',
      sampleOnly: slim.d === 1,
    };
  }

  return {
    CSV_BOM,
    csvEscape,
    neutralizeFormula,
    occupancyToCsv,
    pairsToCsv,
    logToCsv,
    buildPilotPacket,
    encodeSharePayload,
    decodeSharePayload,
    toUrlB64,
    fromUrlB64,
  };
});
