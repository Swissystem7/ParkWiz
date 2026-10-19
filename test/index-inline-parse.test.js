// Every inline <script> in index.html must parse. One dropped line in #239
// (`list.innerHTML = sorted.map(s => {`) turned the whole main script into a
// SyntaxError, so the live map page booted with no handlers at all and none of
// the string-matching UI tests noticed. The browser smoke test
// (test/smoke/index-390.smoke.js) catches it too, but this one runs in plain
// `npm test` with no browser.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('every inline script block in index.html parses', () => {
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(blocks.length >= 3, 'expected the page to carry its inline scripts');
  for (const m of blocks) {
    const line = html.slice(0, m.index).split('\n').length;
    assert.doesNotThrow(() => new vm.Script(m[1], { filename: 'index.html:' + line }),
      'inline script starting at index.html line ' + line + ' does not parse');
  }
});

test('the street list renders through sorted.map', () => {
  assert.match(html, /list\.innerHTML = sorted\.map\(s => \{/);
});
