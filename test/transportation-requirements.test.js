const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DOC_REL = 'docs/transportation-requirements.md';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** Parse markdown table rows that look like | ID | ... | **RATING** | ... | */
function matrixRows(md) {
  const rows = [];
  for (const line of md.split('\n')) {
    if (!/^\|\s*T\d+\s*\|/.test(line)) continue;
    const cells = line.split('|').map((c) => c.trim()).filter((c, i, a) => !(i === 0 || i === a.length - 1 && c === ''));
    // cells: ID, Requirement, Capability, Rating, Evidence
    if (cells.length < 4) continue;
    const id = cells[0];
    const requirement = cells[1];
    const ratingCell = cells[3];
    const ratingMatch = ratingCell.match(/\*\*(FULL|PARTIAL|UNKNOWN)\*\*/);
    assert.ok(ratingMatch, 'row ' + id + ' missing FULL/PARTIAL/UNKNOWN rating: ' + ratingCell);
    rows.push({ id, requirement, rating: ratingMatch[1], line });
  }
  return rows;
}

function findRow(rows, nameRe) {
  const hit = rows.find((r) => nameRe.test(r.requirement));
  assert.ok(hit, 'missing required matrix row matching ' + nameRe);
  return hit;
}

test('docs/transportation-requirements.md exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, DOC_REL)), 'transportation-requirements.md missing');
});

test('transportation-requirements is DRAFT and marks hackathon window PASSED', () => {
  const md = read(DOC_REL);
  assert.match(md, /DRAFT/);
  assert.match(md, /31\.8\.2026 PASSED/);
  assert.doesNotMatch(md, /hackathon (is|still) open/i);
  assert.doesNotMatch(md, /submit before.*(August|September).*2026/i);
});

test('doc frames portfolio readiness and Pilot City TBD', () => {
  const md = read(DOC_REL);
  assert.match(md, /portfolio/i);
  assert.match(md, /Pilot City \(TBD/);
  assert.match(md, /privacy-first/i);
  assert.match(md, /no live cameras/i);
  assert.match(md, /Transportation/i);
});

test('requirements matrix includes required Transportation track rows', () => {
  const rows = matrixRows(read(DOC_REL));
  assert.ok(rows.length >= 8, 'expected at least 8 matrix rows, got ' + rows.length);
  findRow(rows, /\*\*City scale\*\*/i);
  findRow(rows, /\*\*Climate challenge\*\*/i);
  findRow(rows, /\*\*Evidence-based\*\*/i);
  findRow(rows, /\*\*AI-driven\*\*/i);
  findRow(rows, /\*\*Transportation priority\*\*/i);
  findRow(rows, /\*\*Demonstration\*\*/i);
  findRow(rows, /\*\*Pilot plan\*\*/i);
});

test('City scale, Climate challenge, Evidence-based are never UNKNOWN', () => {
  const rows = matrixRows(read(DOC_REL));
  for (const nameRe of [/\*\*City scale\*\*/i, /\*\*Climate challenge\*\*/i, /\*\*Evidence-based\*\*/i]) {
    const row = findRow(rows, nameRe);
    assert.notEqual(row.rating, 'UNKNOWN', row.id + ' must not be UNKNOWN');
    assert.ok(row.rating === 'FULL' || row.rating === 'PARTIAL', row.id + ' must be FULL or PARTIAL');
  }
});

test('every matrix row has an explicit FULL, PARTIAL, or UNKNOWN rating', () => {
  const rows = matrixRows(read(DOC_REL));
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.ok(['FULL', 'PARTIAL', 'UNKNOWN'].includes(row.rating), row.id + ' bad rating');
  }
});

test('doc does not invent a committed city partner', () => {
  const md = read(DOC_REL);
  assert.match(md, /do \*\*not\*\* invent a city commitment/i);
  assert.match(md, /Pilot City \(TBD/);
  // Allow Netanya only as demo geography language, not as signed partner claim
  assert.doesNotMatch(md, /signed (LOI|MOU) with (Netanya|Tel Aviv)/i);
  assert.doesNotMatch(md, /Netanya is (our|the) (approved|committed) pilot city/i);
});

test('privacy-first row is FULL and climate magnitude stays disciplined', () => {
  const md = read(DOC_REL);
  const rows = matrixRows(md);
  const privacy = findRow(rows, /Privacy/i);
  assert.equal(privacy.rating, 'FULL');
  assert.match(md, /UNVERIFIED/);
  assert.match(md, /co-benefit/i);
});
