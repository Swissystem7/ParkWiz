// docs/launch/PILOT-KIT.md step 14 tells the owner to type, in each pending row of
// pilot-compare, the manual count from "the same row number" of the 100-row paper
// sheet. The pending table had no row number: its only key was the processing
// time, and every saved row vanished, so the rows below shifted up. A count typed
// into the wrong row silently corrupts the one accuracy number the 6.10 gate uses.
// Each pending record now carries a fixed frame number (its position in the
// series, 1..N) that stays put while rows are saved.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const html = read('pilot-compare.html');

test('the pending table has a frame-number column', () => {
  const i = html.indexOf('id="pendingBody"');
  const head = html.slice(html.lastIndexOf('<thead>', i), i);
  assert.match(head, /<th>פריים #<\/th>/);
});

test('frame numbers are assigned once from the series order, not from the shifting row index', () => {
  assert.match(html, /function numberFrames\(/);
  const load = html.slice(html.indexOf('function loadPendingFromOccupancy('));
  assert.match(load.slice(0, 300), /numberFrames\(/, 'loading from the kit or a file numbers the frames');
  const init = html.slice(html.indexOf('(function init()'));
  assert.match(init, /numberFrames\(recs\)/, 'the auto-load on open numbers the frames too');
  const i = html.indexOf('pending.forEach((rec, idx)');
  const row = html.slice(i, html.indexOf('tdBtn.appendChild', i));
  assert.match(row, /rec\.frame/, 'the row shows the stored frame number');
  assert.doesNotMatch(row, /\(idx \+ 1\)/, 'the shifting index is not used as a row label');
});

test('changed cached page: the service worker cache moved past v8', () => {
  const v = Number((read('sw.js').match(/const CACHE = 'parkwiz-field-v(\d+)';/) || [])[1]);
  assert.ok(v >= 9, 'cache version ' + v);
});
