// #202 — the Waze-style margins (#201) exist so the product stops claiming
// certainty, which makes the copy itself the thing worth guarding. Two margin
// models feed two surfaces:
//   * src/lib/atidim-lot.js#computeArrivalMargin → demo/atidim.html
//   * src/lib/margin.js                          → demo/atidim-board.html
// Both have to keep saying "חיזוי, לא הבטחה" and keep quoting ranges rather than
// one confident number. The promise scan below is deliberately scoped to the
// margin copy: the pages legitimately promise other things (demo/atidim.html
// promises "פרטיות מובטחת"), just never a parking spot.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const lot = require('../src/lib/atidim-lot');
const margin = require('../src/lib/margin');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const HOURS = Array.from({ length: 24 }, (_, h) => h);

// Promising a spot, in the forms a well-meaning copy edit reaches for. Note
// what is *not* here: "אי־ודאות" is the honest phrasing the board already uses.
const PROMISE = /מובטח|מבטיח|שמור לך|שומר לך|בוודאות|בוודאי|מקום בטוח/;

// Every Hebrew label demo/atidim.html can put on screen for the margin.
const lotLabels = () => HOURS.map((h) => lot.computeArrivalMargin(h).textHe);

// Every Hebrew label demo/atidim-board.html can put on screen, swept across the
// day and both slider extremes.
function boardLabels() {
  const freeByHour = margin.freeByHourFromSeries(lot.hourlySeries(lot.DEFAULT));
  const total = lot.totalBays(lot.DEFAULT);
  const out = [];
  for (const h of HOURS) {
    for (const etaMinutes of [0, margin.DEFAULT_ETA_MIN, margin.MAX_ETA_MIN]) {
      for (const bufferMinutes of [0, margin.DEFAULT_BUFFER_MIN, margin.MAX_BUFFER_MIN]) {
        const m = margin.arrivalMargin({ freeByHour, total, nowMinutes: h * 60, etaMinutes, bufferMinutes });
        assert.ok(m, 'the board lot must always produce a margin');
        out.push([m.headline, m.rangeLabel, m.advice, m.trendLabel, m.tone].join(' · '));
      }
    }
  }
  return out;
}

test('both margin models carry the one shared tone string', () => {
  assert.equal(margin.TONE, 'חיזוי, לא הבטחה');
  // One string, two models: a copy edit on one surface cannot silently leave
  // the other surface sounding more certain than it is.
  for (const text of lotLabels()) assert.ok(text.includes(margin.TONE), text);
  for (const text of boardLabels()) assert.ok(text.includes(margin.TONE), text);
});

test('no margin label on either surface promises a spot', () => {
  const said = [...lotLabels(), ...boardLabels()];
  assert.ok(said.length >= 24 + 24 * 9, 'the sweep has to cover the whole day: ' + said.length);
  for (const text of said) assert.doesNotMatch(text, PROMISE, text);
});

test('every margin label quotes a window and a range, never one bare count', () => {
  for (const h of HOURS) {
    const text = lot.computeArrivalMargin(h).textHe;
    assert.match(text, /תכננו חלון \d\d:\d\d–\d\d:\d\d \(±\d+ דק׳\)/, text);
    // A count with nothing hedging it is the promise. Every free-bay number is
    // either a range, a "כ-" estimate, the single bay spelled out, or a plain
    // statement that the prediction shows none.
    assert.match(
      text,
      /(צפויים \d+–\d+ מקומות פנויים|צפויים כ-\d+ מקומות פנויים|צפוי מקום פנוי אחד בלבד|לא מראה מקומות פנויים)/,
      text,
    );
  }
  for (const text of boardLabels()) {
    assert.match(text, /חלון הגעה \d\d:\d\d–\d\d:\d\d/, text);
  }
});

test('demo/atidim.html shows the margin and derives every word of it from the model', () => {
  const html = read('demo', 'atidim.html');
  assert.match(html, /id="arrivalMargin"[^>]*role="note"/);
  assert.match(html, /model\.computeArrivalMargin\(\(nowHour \+ 1\) % 24, CAPACITY\)\.textHe/);
  // A window or a bay count typed into the markup is how the page drifts away
  // from the curve it claims to be reading.
  const from = html.indexOf('id="arrivalMargin"');
  const markup = html.slice(from, html.indexOf('</p>', from));
  assert.ok(from > 0 && markup.length > 0, 'the margin paragraph must exist');
  assert.doesNotMatch(markup, /\d\d:\d\d/, markup);
  assert.doesNotMatch(markup, /מקומות פנויים/, markup);
  assert.doesNotMatch(html, /מקום מובטח|שומר לך מקום/);
});

test('the operator board states the tone beside the window, not in a footnote', () => {
  const html = read('demo', 'atidim-board.html');
  const from = html.indexOf('aria-labelledby="marginTitle"');
  assert.ok(from > 0, 'the board must have a margin section');
  const section = html.slice(from, html.indexOf('</section>', from));
  assert.doesNotMatch(section, PROMISE, section);
  assert.match(section, /id="marginTone"/);
  assert.match(html, /\$\("marginTone"\)\.textContent = m\.tone/);
});
