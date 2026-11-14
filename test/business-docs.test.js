// PW-602: the business docs exist, README links them, and pitch.html is a
// self-contained RTL page (no external scripts, styles or images).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'docs', 'business');
const DOCS = ['business-model.md', 'pilot-requirements.md', 'pitch.md', 'pitch.html', 'SOURCES.md', 'product-spec-proposal.md', 'infrastructure-options.md', 'atidim-requirements.md', 'payment-channels.md'];

test('all PW-602 business docs exist and are non-empty', () => {
  for (const f of DOCS) {
    const p = path.join(dir, f);
    assert.ok(fs.existsSync(p), `missing ${f}`);
    assert.ok(fs.statSync(p).size > 500, `${f} looks empty`);
  }
});

test('README links the business docs', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  for (const f of ['business-model.md', 'pilot-requirements.md', 'pitch.md', 'SOURCES.md']) {
    assert.ok(readme.includes(`docs/business/${f}`), `README does not link ${f}`);
  }
});

test('relative links inside the business docs resolve', () => {
  for (const f of DOCS.filter((d) => d.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      const target = m[1];
      if (/^[a-z]+:/i.test(target)) continue;
      assert.ok(fs.existsSync(path.join(dir, target)), `${f}: broken link ${target}`);
    }
  }
});

test('pitch.html is RTL Hebrew, self-contained, at most 10 slides', () => {
  const html = fs.readFileSync(path.join(dir, 'pitch.html'), 'utf8');
  assert.match(html, /<html[^>]*lang="he"[^>]*dir="rtl"/);
  assert.match(html, /name="viewport"/);
  assert.doesNotMatch(html, /<(script|link|img|iframe)\b[^>]*(src|href)="https?:/i);
  const slides = html.match(/class="slide"/g) || [];
  assert.ok(slides.length >= 6 && slides.length <= 10, `slides: ${slides.length}`);
});
