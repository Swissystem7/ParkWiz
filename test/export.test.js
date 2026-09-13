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

test('occupancy CSV SHA-256 golden checksum is stable (UTF-8)', () => {
  const hex = exp.occupancyCsvChecksum(occupancy);
  assert.match(hex, /^[a-f0-9]{64}$/);
  // Golden: header + 2 Netanya sample rows (Hebrew street). Update only if schema changes.
  assert.equal(
    hex,
    'd7bc5d112334424869b7c5305827943465f02807e60e7484799d5abc61536b1e'
  );
});
