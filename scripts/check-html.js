'use strict';
// check:html - dependency-free checks over the repository's HTML files:
//   1. no duplicate id="" inside one file
//   2. every local <script src> and <link href> points at a file that exists
//   3. every <img> has an alt attribute (alt="" is fine for decorative images)
// Issues that already existed when this check was added are listed in .html-check-baseline.json and
// reported, but only NEW issues fail the run.
//   node <this file>                    check (exit 1 on new issues)
//   node <this file> --update-baseline  rewrite the baseline from the current state
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const BASELINE = path.join(ROOT, '.html-check-baseline.json');
const SKIP_DIRS = /^(node_modules|coverage|test-results|playwright-report)\//;

function htmlFiles() {
  let files;
  try {
    files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*.html'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  } catch {
    files = [];
  }
  return files.filter((f) => !SKIP_DIRS.test(f) && fs.existsSync(path.join(ROOT, f))).sort();
}

function stripComments(html) {
  // keep line numbers: blank out comments and inline <script>/<style> bodies (markup built in JS
  // strings is runtime state, not static HTML) with the same number of newlines
  const blank = (m) => m.replace(/[^\n]/g, '');
  return html
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi, (m, open, _t, body, close) => open + blank(body) + close);
}

function attr(tag, name) {
  const m = new RegExp('\\s' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(tag);
  return m ? (m[2] ?? m[3] ?? m[4]) : null;
}

function isLocal(ref) {
  return ref && !/^([a-z][a-z0-9+.-]*:|\/\/|#|\{|\$)/i.test(ref) && !/[{}$`+]/.test(ref);
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function check(file) {
  const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const html = stripComments(raw);
  const issues = [];
  const ids = new Map();
  for (const m of html.matchAll(/<[a-zA-Z][^>]*?\sid\s*=\s*("([^"]*)"|'([^']*)')[^>]*>/g)) {
    const id = m[2] ?? m[3];
    if (!id || /[{}$`+]/.test(id)) continue;
    if (ids.has(id)) issues.push({ file, rule: 'duplicate-id', detail: id, line: lineOf(html, m.index) });
    else ids.set(id, true);
  }
  for (const m of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const tag = m[0];
    const ref = m[1].toLowerCase() === 'script' ? attr(tag, 'src') : attr(tag, 'href');
    if (!isLocal(ref)) continue;
    const clean = decodeURI(ref.split(/[?#]/)[0]);
    if (!clean) continue;
    const target = clean.startsWith('/') ? path.join(ROOT, clean) : path.join(ROOT, path.dirname(file), clean);
    const ok = fs.existsSync(target) && (!fs.statSync(target).isDirectory() || fs.existsSync(path.join(target, 'index.html')));
    if (!ok) issues.push({ file, rule: 'missing-' + m[1].toLowerCase(), detail: ref, line: lineOf(html, m.index) });
  }
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    if (!/\salt\s*(=|\s|\/?>)/i.test(m[0])) issues.push({ file, rule: 'img-no-alt', detail: (attr(m[0], 'src') || '').slice(0, 80), line: lineOf(html, m.index) });
  }
  return issues;
}

const key = (i) => i.file + '|' + i.rule + '|' + i.detail;
const files = htmlFiles();
const issues = files.flatMap(check);

if (process.argv.includes('--update-baseline')) {
  const counts = {};
  for (const i of issues) counts[key(i)] = (counts[key(i)] || 0) + 1;
  fs.writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + '\n');
  console.log('check:html: baseline written with ' + issues.length + ' existing issue(s) in ' + files.length + ' file(s)');
  process.exit(0);
}

const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
const seen = {};
const fresh = [];
let known = 0;
for (const i of issues) {
  const k = key(i);
  seen[k] = (seen[k] || 0) + 1;
  if (seen[k] <= (baseline[k] || 0)) known += 1;
  else fresh.push(i);
}
const byRule = {};
for (const i of issues) byRule[i.rule] = (byRule[i.rule] || 0) + 1;
const summary = Object.keys(byRule).length ? Object.entries(byRule).map(([r, n]) => r + ' ' + n).join(', ') : 'none';
console.log('check:html: ' + files.length + ' HTML file(s); issues: ' + summary + ' (' + known + ' known in baseline, ' + fresh.length + ' new)');
for (const i of fresh) console.error('  NEW ' + i.rule + '  ' + i.file + ':' + i.line + '  ' + i.detail);
if (fresh.length) process.exitCode = 1;
