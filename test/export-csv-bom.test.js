const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const exp = require('../src/lib/export');
const offer = require('../src/lib/offer');

// Regression: the pilot CSVs (occupancy, pairs, field log) and the offer quote
// CSV are opened by a municipal reviewer in Excel on Windows. Excel decodes a
// .csv without a UTF-8 byte-order mark in the machine's ANSI code page, so the
// Hebrew street names and inspector notes came out as gibberish. Every CSV the
// app downloads must start with exactly one U+FEFF, directly followed by the
// header row.

const BOM = String.fromCharCode(0xfeff);

const records = [
  { ts: '2026-08-01T07:00:00.000Z', street: 'רחוב הרצל', total: 12, occupied: 7, source: 'heuristic-brightness', confidence: 0.6 },
];
const pairs = [
  { ts: '2026-08-01T07:00:00.000Z', street: 'שדרות בנימין', total: 12, systemOccupied: 7, manualOccupied: 8, accuracy: 0.92, note: 'פקח', source: 'paired' },
];
const days = [
  { day: 1, date: '2026-08-01', lighting: 'לילה', total: 12, systemOccupied: 4, manualOccupied: 5, note: 'פקח', source: 'paired' },
];

test('CSV_BOM is the UTF-8 byte-order mark and nothing else', () => {
  assert.equal(exp.CSV_BOM, BOM);
  assert.equal(exp.CSV_BOM.length, 1);
});

test('every pilot CSV starts with one byte-order mark followed by its header', () => {
  const csvs = {
    occupancy: [exp.occupancyToCsv(records), 'ts,street,total,occupied,source,confidence'],
    pairs: [exp.pairsToCsv(pairs), 'ts,street,total,systemOccupied,manualOccupied,accuracy,note,source'],
    log: [exp.logToCsv(days), 'day,date,lighting,total,systemOccupied,manualOccupied,note,source'],
  };
  for (const [name, [csv, header]] of Object.entries(csvs)) {
    assert.equal(csv.charCodeAt(0), 0xfeff, name + ' must start with U+FEFF');
    assert.equal(csv.split('\n')[0], BOM + header, name + ' header must follow the mark directly');
    assert.equal(csv.split(BOM).length, 2, name + ' must carry the mark exactly once');
  }
});

test('an empty export is still a readable file: mark plus header only', () => {
  const csv = exp.occupancyToCsv([]);
  assert.equal(csv, BOM + 'ts,street,total,occupied,source,confidence');
  assert.equal(exp.pairsToCsv(undefined).split('\n').length, 1);
});

test('the mark does not disturb the formula guard or quoting of the first cell', () => {
  const csv = exp.logToCsv([{ ...days[0], day: '=1+1' }]);
  const row = csv.split('\n')[1];
  assert.match(row, /^'=1\+1,/);
  assert.doesNotMatch(row, /^\uFEFF/);
});

test('the Hebrew text survives a UTF-8 round trip of the file bytes', () => {
  const bytes = Buffer.from(exp.pairsToCsv(pairs), 'utf8');
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.match(bytes.toString('utf8'), /שדרות בנימין/);
});

test('the offer quote CSV carries the same mark once', () => {
  const q = offer.buildQuote({
    authority: 'עיריית נתניה',
    unit: 'אגף תנועה',
    packageId: offer.PACKAGES[0].id,
  });
  const csv = offer.quoteToCsv(q);
  assert.equal(csv.split('\n')[0], BOM + 'field,value');
  assert.equal(csv.split(BOM).length, 2);
  assert.match(csv, /unit,אגף תנועה/);
});

test('download sites hand the CSV straight to the Blob, so the mark is never doubled', () => {
  const root = path.join(__dirname, '..');
  for (const page of ['pilot-compare.html', 'pilot-kit.html', 'pilot-log.html', 'pilot-report.html', 'offer.html']) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    assert.ok(html.indexOf(BOM) === -1 && !/\\uFEFF|\\ufeff/.test(html), page + ' must not add its own byte-order mark');
  }
});
