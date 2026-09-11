// ParkWiz honesty guard for the shoulder surface.
//
// The product rule this file enforces: ParkWiz reports AVAILABILITY - whether a
// space is likely to be free - and never tells anyone that parking somewhere is
// permitted. Whether you may stop on a given shoulder is decided by signs, road
// markings and municipal bylaws; getting that wrong costs a person a ticket or a
// tow. So no user-facing string may carry that vocabulary, in Hebrew or English.
//
// Coverage is enumerated, not sampled. Every string this file checks is listed
// in COVERED below, and the enumerations are asserted to be exhaustive: add a
// string export to src/lib/shoulder.js, or a key to SHOULDER_COPY in index.html,
// and this test fails until the new string is listed here and scanned - a new
// string cannot slip in beside a covered one and be silently exempt.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SH = require('../src/lib/shoulder');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const shoulderSrc = fs.readFileSync(path.join(root, 'src', 'lib', 'shoulder.js'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

// Saying any of these about a place to park is a claim about permission, which
// this product does not have the data to make and must never make.
const FORBIDDEN_HE = [
  'מותר', 'מותרת', 'מותרים', 'חוקי', 'חוקית', 'חוקיות', 'כחוק', 'לפי חוק',
  'רשאי', 'רשאית', 'מורשה', 'מורשית', 'היתר', 'אישור חניה', 'רשות לחנות',
  'ניתן לחנות', 'אפשר לחנות', 'מותר לחנות', 'מותר לעצור',
];
const FORBIDDEN_EN = [
  'allowed', 'legal', 'lawful', 'permitted', 'permissible', 'permission',
  'you may park', 'ok to park', 'free to park',
];

function scan(label, text) {
  const s = String(text == null ? '' : text);
  for (const word of FORBIDDEN_HE) {
    assert.ok(!s.includes(word), `${label} says "${word}": ParkWiz does not rule on permission`);
  }
  const lower = s.toLowerCase();
  for (const word of FORBIDDEN_EN) {
    assert.ok(!lower.includes(word), `${label} says "${word}": ParkWiz does not rule on permission`);
  }
}

// ─── what is covered ────────────────────────────────────────────────────────
const COVERED = [
  'src/lib/shoulder.js: every string-valued export (LABEL_HE, SHORT_LABEL_HE, CURB_LABEL_HE, TARIFF_HE, NOTICE_HE, WHY_HE, SURFACE)',
  'src/lib/shoulder.js: the whole module source, comments included',
  'index.html: every pw:shoulder-copy region - the filter chip, the legend row, and the SHOULDER_COPY block',
  'index.html: every value in SHOULDER_COPY, key by key',
  'index.html: every CURB_TYPES label, shoulder and bay alike',
  'index.html: the nearby-suggestions empty-list line',
  'README.md: every line that mentions שוליים, whatever it says',
];

const EXPECTED_MODULE_STRING_KEYS = [
  'SURFACE', 'LABEL_HE', 'SHORT_LABEL_HE', 'CURB_LABEL_HE', 'TARIFF_HE', 'NOTICE_HE', 'WHY_HE',
];
const EXPECTED_COPY_KEYS = [
  'typeLabel', 'curb', 'tariff', 'notice', 'why', 'listTag', 'mapTag',
  'roomMany', 'roomOne', 'roomNone', 'noEstimate',
  'fitBadge', 'fitShort', 'fitLevelHigh', 'fitLevelMid', 'fitLevelLow', 'fitLevelUnknown',
  'fitHeadlineHigh', 'fitHeadlineMid', 'fitHeadlineLow',
];

function copyRegions() {
  const out = [];
  const re = /pw:shoulder-copy:start([\s\S]*?)pw:shoulder-copy:end/g;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

function shoulderCopyEntries() {
  const block = copyRegions().find((r) => r.includes('const SHOULDER_COPY'));
  assert.ok(block, 'SHOULDER_COPY must live inside a pw:shoulder-copy region');
  const entries = [];
  const re = /^\s{2}([A-Za-z][A-Za-z0-9]*):\s*'([^']*)',\s*$/gm;
  let m;
  while ((m = re.exec(block)) !== null) entries.push([m[1], m[2]]);
  return entries;
}

function curbLabels() {
  const block = html.slice(html.indexOf('const CURB_TYPES = {'), html.indexOf('function lerp('));
  const out = [];
  const re = /label:\s*'([^']*)'/g;
  let m;
  while ((m = re.exec(block)) !== null) out.push(m[1]);
  assert.ok(block.includes('label:SHOULDER_COPY.curb'), 'the shoulder curb label comes from SHOULDER_COPY');
  return out;
}

test('the coverage list is not empty and the enumerations are exhaustive', () => {
  assert.ok(COVERED.length >= 7);

  const moduleStringKeys = Object.entries(SH)
    .filter(([, v]) => typeof v === 'string')
    .map(([k]) => k)
    .sort();
  assert.deepEqual(
    moduleStringKeys, [...EXPECTED_MODULE_STRING_KEYS].sort(),
    'a string export of shoulder.js is not listed in this honesty test - list it and it gets scanned'
  );

  const copyKeys = shoulderCopyEntries().map(([k]) => k).sort();
  assert.deepEqual(
    copyKeys, [...EXPECTED_COPY_KEYS].sort(),
    'a SHOULDER_COPY key is not listed in this honesty test - list it and it gets scanned'
  );
});

test('no string the module exports claims parking is permitted', () => {
  for (const key of EXPECTED_MODULE_STRING_KEYS) scan(`shoulder.js ${key}`, SH[key]);
});

test('the module source itself, comments included, makes no claim about permission', () => {
  scan('shoulder.js source', shoulderSrc);
});

test('every shoulder copy region in the page is clean', () => {
  const regions = copyRegions();
  assert.equal(regions.length, 3, 'expected the filter chip, the legend row and the SHOULDER_COPY block');
  regions.forEach((region, i) => scan(`index.html shoulder region ${i + 1}`, region));
});

test('every SHOULDER_COPY value is clean, key by key', () => {
  for (const [key, value] of shoulderCopyEntries()) {
    assert.ok(value.length > 0, `SHOULDER_COPY.${key} is empty`);
    scan(`SHOULDER_COPY.${key}`, value);
  }
});

test('the page copy and the module constants have not drifted apart', () => {
  const copy = Object.fromEntries(shoulderCopyEntries());
  assert.equal(copy.typeLabel, SH.LABEL_HE);
  assert.equal(copy.curb, SH.CURB_LABEL_HE);
  assert.equal(copy.tariff, SH.TARIFF_HE);
  assert.equal(copy.notice, SH.NOTICE_HE);
  assert.equal(copy.why, SH.WHY_HE);
});

test('every curb label on the map is clean, shoulder and marked bay alike', () => {
  const labels = curbLabels();
  assert.ok(labels.length >= 5, 'expected a label for every curb type');
  labels.forEach((label, i) => scan(`CURB_TYPES label ${i + 1} (${label})`, label));
});

test('the nearby-suggestions list does not rule on any curb segment', () => {
  const line = 'אין קטע חניה מוצע ברדיוס — הרחב חיפוש';
  assert.ok(html.includes(line), 'the empty nearby-suggestions line changed - re-check it and update this test');
  scan('nearby-suggestions empty line', line);
  // the flag that decides what that list shows is named for what it does
  assert.match(html, /suggest:true/);
  assert.doesNotMatch(html, /CURB_TYPES\[ch\.type\]\.park/);
});

// The notice is the other half of the rule: not only must nothing claim
// permission, the page must say out loud, beside the shoulder number, that the
// question is not ours to answer and that signs and markings answer it.
// The README is read by the same people, so it is held to the same rule, and by
// line rather than by a fixed quote: a new sentence about שוליים is scanned the
// moment it is written.
test('the README says what the shoulder surface does and does not claim', () => {
  const lines = readme.split('\n').filter((line) => line.includes('שוליים'));
  assert.ok(lines.length >= 1, 'the README must describe the shoulder surface');
  lines.forEach((line, i) => scan(`README shoulder line ${i + 1}`, line));
  assert.ok(
    lines.some((line) => line.includes('אינו מכריע') && line.includes('שילוט')),
    'the README must say who decides the question ParkWiz does not answer'
  );
});

test('the notice says who decides, and says ParkWiz does not', () => {
  const notice = SH.NOTICE_HE;
  assert.match(notice, /שילוט/);
  assert.match(notice, /תמרור/);
  assert.match(notice, /סימון הכביש/);
  assert.match(notice, /אינו מכריע/);
  assert.match(notice, /הערכת זמינות בלבד/);
  assert.match(notice, /בדיקה בשטח/);
});

test('the notice travels with every shoulder result on the page', () => {
  const uses = html.match(/SHOULDER_COPY\.notice/g) || [];
  assert.ok(uses.length >= 2, 'the notice must be rendered, not merely defined');
  // the shared block that the list row and the street card both render
  assert.match(html, /function shoulderNoteHtml\(idx, signalPct\)[\s\S]*?SHOULDER_COPY\.notice/);
  // and the arrival panel, which suggests shoulders among nearby curb segments
  assert.match(html, /function arrivalShoulderNote\(rows\)[\s\S]*?SHOULDER_COPY\.notice/);
  assert.match(html, /\$\{arrivalShoulderNote\(suggested\)\}/);
});
