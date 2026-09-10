const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DPIA_REL = 'docs/DPIA-skeleton.md';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('docs/DPIA-skeleton.md exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, DPIA_REL)), 'DPIA-skeleton.md missing');
});

test('DPIA skeleton is marked DRAFT and not a legal filing', () => {
  const md = read(DPIA_REL);
  assert.match(md, /DRAFT/);
  assert.match(md, /not a legal filing/i);
});

for (const heading of [
  '## 2. Data categories',
  '## 3. Legal basis',
  '## 4. Data minimization',
  '## 5. Retention',
  '## 6. Controls',
]) {
  test(`DPIA skeleton includes required section: ${heading}`, () => {
    const md = read(DPIA_REL);
    assert.match(md, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
}

test('DPIA skeleton marks unclear PII / legal items as NEEDS-LEGAL', () => {
  const md = read(DPIA_REL);
  const hits = md.match(/NEEDS-LEGAL/g) || [];
  assert.ok(hits.length >= 3, `expected ≥3 NEEDS-LEGAL markers, got ${hits.length}`);
});

test('DPIA skeleton states privacy-first / local-first / no live cameras / no person ID', () => {
  const md = read(DPIA_REL);
  assert.match(md, /privacy-first/i);
  assert.match(md, /local-first/i);
  assert.match(md, /no live cameras/i);
  assert.match(md, /no (person identification|ANPR|LPR|faces)/i);
});

test('DPIA skeleton does not invent cloud PII collection', () => {
  const md = read(DPIA_REL);
  assert.match(md, /no cloud backend/i);
  assert.match(md, /synthetic: true/);
  assert.doesNotMatch(md, /we (collect|upload|sync) (user|personal) data to (AWS|GCP|Azure|Firebase)/i);
});

test('DPIA open checklist uses unchecked markdown tasks', () => {
  const md = read(DPIA_REL);
  assert.match(md, /- \[ \] City DPO/);
  assert.match(md, /- \[ \] Written retention/);
  assert.match(md, /- \[ \] Camera \/ VMS access/);
});
