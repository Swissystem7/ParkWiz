// The pilot legal pack (#270) goes to Atidim's lawyer before anyone plugs into a
// camera, so these pin what would be expensive to let drift: the draft disclaimer,
// the agreement's ten terms, the controller/processor split, the Reg. 15 items, the
// KPIs we offer to be held to, and the rule that we invent no citations.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const FILES = {
  agreement: 'pilot-agreement-draft-he', privacy: 'privacy-amendment13-he',
  annex: 'dpa-security-annex-he', questions: 'meeting-questions-he',
};
const docs = {};
for (const [key, file] of Object.entries(FILES)) docs[key] = read(path.join('docs', 'legal', file + '.md'));
const page = read('pilot-atidim.html');
const pins = (text, label, list) => { for (const re of list) assert.match(text, re, label); };

test('every doc is a marked draft, and cites nothing beyond the listed sources', () => {
  const mark = /טיוטה לדיון, לא ייעוץ משפטי/;
  assert.match(page, mark, 'the page repeats the disclaimer next to the links');
  for (const [name, text] of Object.entries(docs)) {
    assert.match(text, mark, name + ' needs the disclaimer');
    assert.doesNotMatch(text, /GDPR|תקנת? \d+(?!5)|ISO 27001/, name + ' invents a citation');
    assert.doesNotMatch(text, /סעיף \d+ לחוק/, name + ' cites an unverified statute section');
  }
});

test('the agreement draft carries all ten pilot terms', () => {
  pins(docs.agreement, 'agreement', [
    /4 שבועות/, /0 ₪/,                        // free four-week pilot
    /קריאה בלבד/, /אינו הזמנה/,                 // read-only access, no purchase commitment
    /מפסק חירום/, /להפסיק את הפיילוט בכל רגע/,   // kill switch, either side stops anytime
    /נשארת הבעלים של הקוד/,                    // ParkWiz keeps code and models
    /רשות למדוד אינה רשות לאמן/,               // measuring is not training
    /רשות למדוד אינה רשות לפרסם/,              // the name is a separate permission
    /לפי אתר/, /לפי תא מנוטר/, /ייקבעו בהסכמה/,  // pricing per site or per space, to be agreed
    /אישור מחיקה בכתב/,                        // wind-down and deletion
  ]);
});

test('the privacy one-pager states Amendment 13, roles, minimization and the open questions', () => {
  pins(docs.privacy, 'privacy', [
    /תיקון 13/, /14\.8\.2025/,                 // in force on that date
    /לא אומר «אין מידע אישי/,                  // no plates may still be personal data
    /בעל שליטה/, /מחזיק/, /התאמת מטרה/,        // roles, purpose compatibility
    /בזיכרון/, /מטושטשת/,                      // in-memory frames, blurred calibration still
    /ממונה על הגנת הפרטיות/,                   // the privacy officer question
    /DPIA/, /אינה תסקיר השפעה פורמלי/,          // DPIA-style summary, and not a formal one
  ]);
});

test('the security annex covers the Reg. 15 items', () => {
  pins(docs.annex, 'annex', [
    /תקנות הגנת הפרטיות \(אבטחת מידע\), תשע״ז‑2017/, /\*\*תקנה 15\*\*/,
    /בקרת גישה/, /משתמש RTSP לקריאה בלבד/, /אין פורט נכנס/, /יומן גישה/,
    /\*\*בתוך 24 שעות\*\* מהגילוי/, /אישור מחיקה בכתב/, // incident notice, deletion
    /אין\.\*\* הוספה/,                          // no sub-processors without written approval
  ]);
});

test('the meeting sheet asks eight numbered questions and names the KPI targets', () => {
  const numbered = docs.questions.match(/^\*\*\d\. /gm) || [];
  assert.equal(numbered.length, 8, 'exactly eight questions for Roni and Yoav');
  pins(docs.questions, 'questions', [
    /פיילוט חד־פעמי/, /מי הישות שחותמת/, /ביטוח/,
    /≥ 98%/, /≥ 90%/, /p95/, /≤ 10 שניות/,
  ]);
});

test('the pilot page links the whole pack, and the docs cross-link each other', () => {
  for (const f of Object.values(FILES)) assert.ok(page.includes('./docs/legal/' + f + '.md'), 'page must link ' + f);
  // A lawyer handed one doc finds the rest: each links two siblings and the plan.
  for (const [name, text] of Object.entries(docs)) {
    const siblings = Object.values(FILES).filter((f) => f !== FILES[name] && text.includes(f + '.md'));
    assert.ok(siblings.length >= 2, name + ' must link at least two siblings, got ' + siblings.length);
  }
  assert.match(docs.agreement, /\.\.\/pilot-atidim\.md/, 'the agreement links the pilot plan');
  assert.match(docs.questions, /\.\.\/pilot-atidim\.md/, 'the question sheet links the pilot plan');
});
