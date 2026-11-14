'use strict';
// check:a11y-static - dependency-free accessibility checks over the repository's HTML files:
//   html-no-lang   <html> has no lang attribute
//   html-no-rtl    the page text is Hebrew but <html> has no dir="rtl"
//   button-empty   <button> with no text, no aria-label / aria-labelledby / title and no img alt
//   field-no-label <input>/<select> with no <label for>, no wrapping <label>, no aria-label /
//                  aria-labelledby / title (hidden/submit/button/reset/image inputs are skipped)
// Markup inside comments and inline <script>/<style> is ignored (it is built at run time).
// Issues that existed when the check was added are listed in .a11y-static-baseline.json and
// reported; only NEW issues fail the run.
//   node <this file>                    check (exit 1 on new issues)
//   node <this file> --update-baseline  rewrite the baseline from the current state
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const BASELINE = path.join(ROOT, '.a11y-static-baseline.json');
const SKIP_DIRS = /^(node_modules|coverage|test-results|playwright-report)\//;
const HEBREW = /[\u0590-\u05FF]/g;

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

function stripRuntime(html) {
  const blank = (m) => m.replace(/[^\n]/g, '');
  return html
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(<(script|style|template)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi, (m, open, _t, body, close) => open + blank(body) + close);
}

function attr(tag, name) {
  const m = new RegExp('\\s' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(tag);
  return m ? (m[2] ?? m[3] ?? m[4]) : null;
}

const named = (tag) => ['aria-label', 'aria-labelledby', 'title'].some((a) => (attr(tag, a) || '').trim());
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const textOf = (inner) =>
  inner
    .replace(/<img\b[^>]*>/gi, (t) => ' ' + (attr(t, 'alt') || '') + ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .trim();

function check(file) {
  const html = stripRuntime(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const issues = [];
  const add = (rule, detail, index) => issues.push({ file, rule, detail, line: lineOf(html, index) });

  const htmlTag = /<html\b[^>]*>/i.exec(html);
  if (htmlTag) {
    if (!(attr(htmlTag[0], 'lang') || '').trim()) add('html-no-lang', '<html>', htmlTag.index);
    const visible = html.replace(/<[^>]+>/g, ' ');
    const hebrew = (visible.match(HEBREW) || []).length;
    const latin = (visible.match(/[A-Za-z]/g) || []).length;
    const lang = (attr(htmlTag[0], 'lang') || '').toLowerCase();
    const hebrewPage = lang.startsWith('he') || lang.startsWith('iw') || (!lang && hebrew > latin / 4 && hebrew > 20);
    if (hebrewPage && (attr(htmlTag[0], 'dir') || '').toLowerCase() !== 'rtl') add('html-no-rtl', 'lang=' + (lang || '-'), htmlTag.index);
  }

  for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button\s*>/gi)) {
    if (named(m[0].slice(0, m[0].indexOf('>') + 1)) || textOf(m[2])) continue;
    add('button-empty', attr(m[0], 'id') || attr(m[0], 'class') || '(no id)', m.index);
  }

  const forIds = new Set([...html.matchAll(/<label\b[^>]*>/gi)].map((m) => attr(m[0], 'for')).filter(Boolean));
  const labelRanges = [...html.matchAll(/<label\b[^>]*>[\s\S]*?<\/label\s*>/gi)].map((m) => [m.index, m.index + m[0].length]);
  const inLabel = (i) => labelRanges.some(([a, b]) => i > a && i < b);
  for (const m of html.matchAll(/<(input|select)\b[^>]*>/gi)) {
    const tag = m[0];
    if (m[1].toLowerCase() === 'input' && /^(hidden|submit|button|reset|image)$/i.test(attr(tag, 'type') || '')) continue;
    const id = attr(tag, 'id');
    if (named(tag) || (id && forIds.has(id)) || inLabel(m.index)) continue;
    add('field-no-label', m[1].toLowerCase() + (id ? '#' + id : attr(tag, 'name') ? '[name=' + attr(tag, 'name') + ']' : ''), m.index);
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
  console.log('check:a11y-static: baseline written with ' + issues.length + ' existing issue(s) in ' + files.length + ' file(s)');
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
console.log('check:a11y-static: ' + files.length + ' HTML file(s); issues: ' + summary + ' (' + known + ' known in baseline, ' + fresh.length + ' new)');
for (const i of fresh) console.error('  NEW ' + i.rule + '  ' + i.file + ':' + i.line + '  ' + i.detail);
if (fresh.length) process.exitCode = 1;
