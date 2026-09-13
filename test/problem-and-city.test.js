const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DOC_REL = 'docs/problem-and-city.md';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function sectionBody(md, heading) {
  const start = md.indexOf(heading);
  assert.ok(start >= 0, 'missing heading: ' + heading);
  const after = md.slice(start + heading.length);
  const next = after.search(/\n## /);
  const body = (next < 0 ? after : after.slice(0, next)).trim();
  assert.ok(body.length > 40, 'section too short: ' + heading);
  return body;
}

test('docs/problem-and-city.md exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, DOC_REL)), 'problem-and-city.md missing');
});

test('problem-and-city is DRAFT and marks hackathon window PASSED', () => {
  const md = read(DOC_REL);
  assert.match(md, /DRAFT/);
  assert.match(md, /31\.8\.2026 PASSED/);
  assert.doesNotMatch(md, /hackathon (is|still) open/i);
});

for (const heading of [
  '## Checklist (must stay non-empty)',
  '## 1. City',
  '## 2. Problem',
  '## 3. Climate link',
  '## 4. Beneficiaries',
]) {
  test('problem-and-city includes required section: ' + heading, () => {
    const md = read(DOC_REL);
    assert.match(md, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    sectionBody(md, heading);
  });
}

test('checklist table has non-empty City/Problem/Climate/Beneficiaries rows', () => {
  const md = read(DOC_REL);
  assert.match(md, /\|\s*\*\*City\*\*\s*\|[^|\n]{8,}\|/);
  assert.match(md, /\|\s*\*\*Problem\*\*\s*\|[^|\n]{8,}\|/);
  assert.match(md, /\|\s*\*\*Climate link\*\*\s*\|[^|\n]{8,}\|/);
  assert.match(md, /\|\s*\*\*Beneficiaries\*\*\s*\|[^|\n]{8,}\|/);
});

test('city framing uses placeholder and OWNER-DECISION / UNVERIFIED markers', () => {
  const md = read(DOC_REL);
  assert.match(md, /Pilot City \(TBD/);
  assert.match(md, /OWNER-DECISION/);
  assert.match(md, /UNVERIFIED/);
  assert.match(md, /illustrative demo geography/i);
});

test('problem section covers search time / congestion and privacy-first measure', () => {
  const body = sectionBody(read(DOC_REL), '## 2. Problem');
  assert.match(body, /circling for curb parking/i);
  assert.match(body, /congestion/i);
  assert.match(body, /privacy-first/i);
  assert.match(body, /occupied vs free/i);
});

test('climate link is narrative co-benefit and marks magnitude UNVERIFIED', () => {
  const body = sectionBody(read(DOC_REL), '## 3. Climate link');
  assert.match(body, /emissions/i);
  assert.match(body, /fuel/i);
  assert.match(body, /UNVERIFIED/);
  assert.match(body, /co-benefit/i);
});

test('beneficiaries include municipal units and exclude paying-driver claim', () => {
  const body = sectionBody(read(DOC_REL), '## 4. Beneficiaries');
  assert.match(body, /traffic \/ parking/i);
  assert.match(body, /innovation/i);
  assert.match(body, /not\*\* a paying customer/i);
});

test('doc stays local-first and does not invent cloud product features', () => {
  const md = read(DOC_REL);
  assert.match(md, /local-first/i);
  assert.match(md, /no live cameras/i);
  assert.doesNotMatch(md, /Firebase|AWS Cognito|Stripe live billing/i);
});
