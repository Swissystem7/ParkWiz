const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const proto = require('../src/lib/protocol');

const root = path.join(__dirname, '..');
const log = fs.readFileSync(path.join(root, 'pilot-log.html'), 'utf8');
const brief = fs.readFileSync(path.join(root, 'pilot-brief.html'), 'utf8');
const method = fs.readFileSync(path.join(root, 'pilot-method.html'), 'utf8');
const evalPage = fs.readFileSync(path.join(root, 'pilot-eval.html'), 'utf8');
const outreach = fs.readFileSync(path.join(root, 'NETANYA_OUTREACH.md'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sampleLog = JSON.parse(fs.readFileSync(path.join(root, 'pilot', 'sample-log.json'), 'utf8'));

test('new municipal surfaces are Hebrew RTL with an honesty banner', () => {
  for (const html of [log, brief, method, evalPage]) {
    assert.match(html, /lang="he"/);
    assert.match(html, /dir="rtl"/);
    assert.match(html, /class="banner"/);
    assert.doesNotMatch(html, /unpkg|cdnjs|googleapis/i);
  }
  assert.match(log, /לא ספירת פקח/);
  assert.match(brief, /אין מנוע הפרות|לא אכיפה/);
  assert.match(method, /היוריסטיקה/);
  assert.match(evalPage, /לא דיוק שדה/);
});

test('homepage evaluator banner points at the pilot, not a live feed', () => {
  assert.match(index, /class="eval-banner"/);
  assert.match(index, /offer\.html/);
  assert.match(index, /pilot-brief\.html/);
  assert.match(index, /pilot-log\.html/);
  assert.match(index, /pilot-eval\.html/);
  assert.match(index, /pilot-method\.html/);
  assert.match(index, /נתוני <b>הדגמה<\/b>/);
});

test('outreach draft no longer promises enforcement revenue', () => {
  const letter = outreach.slice(outreach.indexOf('שלום'), outreach.indexOf('## ערוץ 2'));
  assert.match(outreach, /תפוס \/ פנוי/);
  assert.match(outreach, /לא נשלח/);
  assert.doesNotMatch(letter, /הפרות שזוהו לשעה/);
  assert.doesNotMatch(letter, /המלצות אכיפה/);
  assert.doesNotMatch(letter, /הכנסות אכיפה/);
  assert.match(letter, /מה \*\*אין\*\* בפיילוט: אכיפה/);
});

test('sample field log is 30 days and decides SAMPLE_ONLY', () => {
  assert.equal(sampleLog.source, 'sample');
  assert.equal(sampleLog.days.length, 30);
  assert.ok(sampleLog.note.includes('לא ספירת פקח'));
  const pairs = proto.logToPairs(sampleLog.days, sampleLog.street);
  assert.ok(pairs.length >= proto.MIN_PAIRS);
  assert.ok(pairs.every((p) => p.source === 'sample'));
  const v = proto.decidePilot({ pairs });
  assert.equal(v.code, 'SAMPLE_ONLY');
});
