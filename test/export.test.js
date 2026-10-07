const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const occ = require('../src/lib/occupancy');
const cmp = require('../src/lib/compare');
const exp = require('../src/lib/export');

const occupancy = [
  { ts: '2026-08-12T08:00:00+03:00', street: 'הרצל, נתניה', total: 12, occupied: 5, source: 'heuristic-brightness', confidence: 0.45 },
  { ts: '2026-08-12T09:00:00+03:00', street: 'הרצל, נתניה', total: 12, occupied: 7, source: 'heuristic-brightness', confidence: 0.45 },
];
const pairs = [
  cmp.pairObservation({ ts: occupancy[0].ts, street: occupancy[0].street, total: 12, systemOccupied: 5, manualOccupied: 4, source: 'paired', note: 'פקח, "בוקר"' }),
  cmp.pairObservation({ ts: occupancy[1].ts, street: occupancy[1].street, total: 12, systemOccupied: 7, manualOccupied: 7, source: 'paired', note: '' }),
];

test('occupancy CSV has a header and one row per record', () => {
  const csv = exp.occupancyToCsv(occupancy);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'ts,street,total,occupied,source,confidence');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /heuristic-brightness/);
});

test('pairs CSV quotes fields that contain commas or quotes', () => {
  const csv = exp.pairsToCsv(pairs);
  assert.match(csv, /"פקח, ""בוקר"""/);
  assert.match(csv, /systemOccupied,manualOccupied,accuracy/);
});

test('pilot packet carries occupancy, pairs, and the same summary', () => {
  const packet = exp.buildPilotPacket({ occupancy, pairs, generatedAt: '2026-08-13T10:00:00Z' });
  assert.equal(packet.kind, 'parkwiz-pilot-packet');
  assert.equal(packet.version, 1);
  assert.equal(packet.street, 'הרצל, נתניה');
  assert.equal(packet.summary.count, 2);
  assert.ok(Math.abs(packet.summary.meanAccuracy - (pairs[0].accuracy + 1) / 2) < 1e-12);
  assert.match(packet.note, /אין מצלמה חיה/);
});

test('share payload round-trips through URL-safe base64 without a server', () => {
  const packet = exp.buildPilotPacket({ occupancy, pairs, generatedAt: '2026-08-13T10:00:00Z' });
  const token = exp.encodeSharePayload(packet);
  assert.equal(token.includes('+'), false);
  assert.equal(token.includes('/'), false);
  const decoded = exp.decodeSharePayload(token);
  assert.equal(decoded.street, 'הרצל, נתניה');
  assert.equal(decoded.count, 2);
  assert.equal(decoded.perfect, 1);
  assert.equal(decoded.sampleOnly, false);
  assert.equal(decoded.lastSystem, 7);
  assert.equal(decoded.lastManual, 7);
  assert.equal(decoded.lastTotal, 12);
  assert.ok(Math.abs(decoded.meanAccuracy - packet.summary.meanAccuracy) < 1e-12);
});

test('decode rejects junk and marks a sample-only series', () => {
  assert.equal(exp.decodeSharePayload('%%%'), null);
  assert.equal(exp.decodeSharePayload(''), null);
  const sample = cmp.pairObservation({
    ts: 't', street: 'הרצל', total: 10, systemOccupied: 4, manualOccupied: 4, source: 'sample',
  });
  const token = exp.encodeSharePayload(exp.buildPilotPacket({ pairs: [sample] }));
  assert.equal(exp.decodeSharePayload(token).sampleOnly, true);
});

test('occupancy parse still accepts the kit schema used by export', () => {
  const csv = exp.occupancyToCsv(occupancy);
  assert.ok(occ.parse(JSON.stringify(occupancy)).length === 2);
  assert.match(csv, /הרצל/);
});

test('field-log CSV keeps empty days as blank cells', () => {
  const csv = exp.logToCsv([
    { day: 1, date: '2026-08-01', lighting: 'לילה', total: 12, systemOccupied: 4, manualOccupied: 5, note: 'פקח, "לילה"', source: 'sample' },
    { day: 2, date: '2026-08-02', lighting: '', total: null, systemOccupied: null, manualOccupied: null, note: '', source: '' },
  ]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'day,date,lighting,total,systemOccupied,manualOccupied,note,source');
  assert.match(lines[1], /"פקח, ""לילה"""/);
  assert.match(lines[2], /^2,2026-08-02,,,,,,$/);
});

test('README names the comparison, summary, and field PWA honestly', () => {
  const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  assert.match(readme, /pilot-compare\.html/);
  assert.match(readme, /pilot-summary\.html/);
  assert.match(readme, /pilot-log\.html/);
  assert.match(readme, /pilot-brief\.html/);
  assert.match(readme, /offer\.html/);
  assert.match(readme, /MONETIZATION\.md/);
  assert.match(readme, /pilot-calibrate\.html/);
  assert.match(readme, /pilot-eval\.html/);
  assert.match(readme, /pilot-method\.html/);
  assert.match(readme, /PWA/);
  assert.match(readme, /sample/);
});

test('decodeSharePayload rejects negative count values', () => {
  const packet = exp.buildPilotPacket({ pairs });
  const token = exp.encodeSharePayload(packet);
  // Manually construct a token with negative 'n' value to test validation
  const decoded = exp.decodeSharePayload(token);
  // Modify the token to have negative count
  const modifiedSlim = { ...decoded, count: -5 };
  const modifiedToken = exp.toUrlB64(JSON.stringify({
    v: 1,
    s: modifiedSlim.street,
    n: -5,
    a: modifiedSlim.meanAccuracy,
    i: modifiedSlim.minAccuracy,
    x: modifiedSlim.maxAccuracy,
    e: modifiedSlim.meanAbsError,
    p: modifiedSlim.perfect,
    f: modifiedSlim.firstTs,
    t: modifiedSlim.lastTs,
    ls: modifiedSlim.lastSystem,
    lm: modifiedSlim.lastManual,
    lt: modifiedSlim.lastTotal,
    g: modifiedSlim.generatedAt,
    d: modifiedSlim.sampleOnly ? 1 : 0,
  }));
  assert.equal(exp.decodeSharePayload(modifiedToken), null);
});

// The share hash is just base64 — anyone can edit it by hand. The read-only
// summary page prints the decoded numbers verbatim, so a doctored token must
// not be able to show 150% accuracy, more perfect pairs than pairs, or a last
// count larger than the lot. Out-of-domain figures mean a corrupt link.
test('decodeSharePayload rejects figures outside the domain the encoder produces', () => {
  const slimOf = (token) => JSON.parse(exp.fromUrlB64(token));
  const tokenOf = (slim) => exp.toUrlB64(JSON.stringify(slim));
  const good = slimOf(exp.encodeSharePayload(exp.buildPilotPacket({ pairs })));
  assert.notEqual(exp.decodeSharePayload(tokenOf(good)), null);

  const tampered = [
    { a: 1.5 },           // mean accuracy above 100%
    { a: -0.1 },          // negative accuracy
    { i: 1.2 },           // min accuracy above 100%
    { x: 7 },             // max accuracy above 100%
    { i: 0.9, x: 0.5 },   // min above max
    { e: -3 },            // negative mean absolute error
    { p: 99 },            // more perfect pairs than pairs (n = 2)
    { p: -1 },            // negative perfect count
    { p: 1.5 },           // fractional perfect count
    { p: 'abc' },         // non-numeric perfect count
    { lt: -12 },          // negative lot size
    { ls: 40 },           // last system count above last total (12)
    { lm: -2 },           // negative last manual count
  ];
  for (const patch of tampered) {
    const token = tokenOf({ ...good, ...patch });
    assert.equal(exp.decodeSharePayload(token), null, JSON.stringify(patch));
  }

  // Boundary values the encoder can legitimately produce still decode.
  const edge = exp.decodeSharePayload(tokenOf({ ...good, a: 1, i: 0, x: 1, e: 0, p: 2, ls: 12, lm: 0 }));
  assert.equal(edge.meanAccuracy, 1);
  assert.equal(edge.minAccuracy, 0);
  assert.equal(edge.perfect, 2);
  assert.equal(edge.lastSystem, 12);
  assert.equal(edge.lastManual, 0);

  // A missing perfect field still means zero, and an empty series (n = 0) with
  // null figures is a valid, if empty, summary.
  const noPerfect = exp.decodeSharePayload(tokenOf({ ...good, p: undefined }));
  assert.equal(noPerfect.perfect, 0);
  const empty = exp.decodeSharePayload(exp.encodeSharePayload(exp.buildPilotPacket({ pairs: [] })));
  assert.equal(empty.count, 0);
  assert.equal(empty.perfect, 0);
  assert.equal(empty.meanAccuracy, null);
  assert.equal(empty.lastTotal, null);
});

// A municipal reviewer opens these files in Excel. A note typed by a field
// worker such as =HYPERLINK(...) or -2+3 must arrive as text, not as a formula.
test('CSV cells that start with a formula trigger are neutralized', () => {
  for (const bad of ['=HYPERLINK("http://x","go")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd']) {
    const cell = exp.csvEscape(bad);
    const unquoted = cell.startsWith('"') ? cell.slice(1, -1).replace(/""/g, '"') : cell;
    assert.equal(unquoted, "'" + bad, `expected ${JSON.stringify(bad)} to be prefixed`);
  }
});

test('plain numbers and ordinary text are not touched by the formula guard', () => {
  assert.equal(exp.csvEscape(-5), '-5');
  assert.equal(exp.csvEscape('-5'), '-5');
  assert.equal(exp.csvEscape('-0.45'), '-0.45');
  assert.equal(exp.csvEscape(0.45), '0.45');
  assert.equal(exp.csvEscape('הרצל, נתניה'), '"הרצל, נתניה"');
  assert.equal(exp.csvEscape('2026-08-12T08:00:00+03:00'), '2026-08-12T08:00:00+03:00');
  assert.equal(exp.csvEscape('—'), '—');
  assert.equal(exp.csvEscape(''), '');
  assert.equal(exp.csvEscape(null), '');
});

test('a hostile note in the field log and pairs CSV is exported as text', () => {
  const log = exp.logToCsv([
    { day: 1, date: '2026-08-01', lighting: '=1+1', total: 12, systemOccupied: 4, manualOccupied: 5, note: '=HYPERLINK("http://evil","click")', source: 'paired' },
  ]);
  assert.match(log.split('\n')[1], /^1,2026-08-01,'=1\+1,12,4,5,"'=HYPERLINK\(""http:\/\/evil"",""click""\)",paired$/);
  const pairsCsv = exp.pairsToCsv([{ ...pairs[0], note: '@cmd', street: '-x' }]);
  assert.match(pairsCsv.split('\n')[1], /,'-x,/);
  assert.match(pairsCsv.split('\n')[1], /,'@cmd,/);
});

test('decodeSharePayload accepts a mean that overshoots max only by float rounding', () => {
  const same = [0.1, 0.1, 0.1].map((accuracy, k) => ({ ...pairs[0], ts: '2026-08-12T0' + k + ':00:00+03:00', accuracy }));
  const token = exp.encodeSharePayload(exp.buildPilotPacket({ pairs: same }));
  const decoded = exp.decodeSharePayload(token);
  assert.notEqual(decoded, null);
  assert.ok(decoded.meanAccuracy > decoded.maxAccuracy, 'fixture should exercise the rounding overshoot');
});
