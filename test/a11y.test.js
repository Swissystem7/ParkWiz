const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'pilot', 'shell.css'), 'utf8');
const nav = fs.readFileSync(path.join(root, 'src', 'lib', 'surface-nav.js'), 'utf8');
const report = fs.readFileSync(path.join(root, 'pilot-report.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('map has a skip link, labelled search, and reduced-motion rules', () => {
  assert.match(html, /class="skip-link"/);
  assert.match(html, /href="#searchInput"/);
  assert.match(html, /aria-label="חיפוש רחוב בנתניה"/);
  assert.match(html, /aria-controls="autocomplete"/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /:focus-visible/);
});

test('toggleable map controls expose aria-pressed and keep it in sync', () => {
  assert.match(html, /id="heatmapBtn"[^>]*aria-pressed="false"/);
  assert.match(html, /btn\.setAttribute\('aria-pressed', heatmapActive \? 'true' : 'false'\)/);
  assert.match(html, /btn\.setAttribute\('aria-pressed', activeFilters\[type\] \? 'true' : 'false'\)/);
  assert.match(html, /chip\.setAttribute\('aria-pressed', on \? 'true' : 'false'\)/);
});

test('displayed chance uses the shared probability helper, not an inline clamp', () => {
  assert.match(html, /src="src\/lib\/probability\.js"/);
  assert.match(html, /function combineDisplayedPct/);
  assert.match(html, /displayedAvailabilityPct\(/);
  assert.match(html, /combineDisplayedPct\(model\.score/);
});

test('pilot chrome and surface nav finish the a11y pass', () => {
  assert.match(shell, /prefers-reduced-motion/);
  assert.match(shell, /:focus-visible/);
  assert.match(shell, /\.skip-link/);
  assert.match(nav, /aria-current',\s*'page'/);
  assert.match(report, /OCC\.inspectorAccuracy\(/);
  const pages = [
    'pilot-log.html', 'pilot-brief.html', 'pilot-method.html', 'pilot-eval.html',
    'pilot-kit.html', 'offer.html', 'pilot-compare.html', 'pilot-report.html',
    'pilot-summary.html', 'pilot-privacy.html', 'pilot-dashboard.html', 'marketplace.html',
    'pilot-calibrate.html',
  ];
  for (const name of pages) {
    const page = fs.readFileSync(path.join(root, name), 'utf8');
    assert.match(page, /class="skip-link"|class='skip-link'/, `${name} needs a skip link`);
    assert.match(page, /lang="he"/, `${name} must be Hebrew`);
    assert.match(page, /dir="rtl"/, `${name} must be RTL`);
  }
  const offerPage = fs.readFileSync(path.join(root, 'offer.html'), 'utf8');
  assert.match(offerPage, /role="alert"/);
  const log = fs.readFileSync(path.join(root, 'pilot-log.html'), 'utf8');
  assert.match(log, /aria-pressed/);
});

test('map does not lock browser zoom (WCAG reflow)', () => {
  assert.doesNotMatch(html, /maximum-scale\s*=\s*1/);
});

test('npm test runs the test directory as a glob (Node 24 does not accept a bare "test" path)', () => {
  assert.equal(pkg.scripts.test, 'node --test test/*.js');
});
