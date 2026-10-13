// ParkWiz — PR size budget and a split plan.
//
// auto_merger only merges a pull request of at most 400 changed lines
// (additions + deletions). A bigger PR sits open until somebody splits it by
// hand, which is how PR #126 reached 978 lines. This module turns
// `git diff --numstat` into a number and, when that number is over budget,
// into a concrete grouping of the changed files into PR-sized parts.
//
// A part is only useful on its own if a module travels with its tests and a
// page travels with the script it loads, so files are grouped into cohesive
// "units" first and never split across parts.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizPrSize = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const LIMIT = 400;

  // `git diff --numstat` -> [{ path, added, deleted, changed, binary }]
  function parseNumstat(text) {
    return String(text == null ? '' : text)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const cols = line.split('\t');
        if (cols.length < 3) return null;
        const binary = cols[0] === '-' || cols[1] === '-';
        const added = binary ? 0 : Number(cols[0]);
        const deleted = binary ? 0 : Number(cols[1]);
        if (!Number.isFinite(added) || !Number.isFinite(deleted)) return null;
        // A rename prints "old => new"; the new path is what a reviewer opens.
        const raw = cols.slice(2).join('\t');
        const renamed = /=>/.test(raw)
          ? raw.replace(/^(.*)\{(.*) => (.*)\}(.*)$/, '$1$3$4').replace(/^.* => /, '')
          : raw;
        const path = renamed.replace(/^\.\//, '').trim();
        if (!path) return null;
        return { path, added, deleted, changed: added + deleted, binary };
      })
      .filter(Boolean);
  }

  function totalChanged(files) {
    return (files || []).reduce((sum, f) => sum + (f.changed || 0), 0);
  }

  // Which reviewable unit a file belongs to. `changedPaths` is the set of paths
  // in the same diff, so a test only joins a module that is actually changing.
  function unitKey(filePath, changedPaths) {
    const p = String(filePath || '').replace(/^\.\//, '');
    const has = (candidate) => !!(changedPaths && changedPaths.has(candidate));

    const lib = /^src\/lib\/([^/]+)\.js$/.exec(p);
    if (lib) return 'lib:' + lib[1];

    const spec = /^test\/(.+)\.test\.js$/.exec(p);
    if (spec) {
      // test/compare-frame-number.test.js reviews src/lib/compare.js, so trim
      // one dash-separated suffix at a time until a changed module matches.
      const parts = spec[1].split('-');
      while (parts.length) {
        const name = parts.join('-');
        if (has('src/lib/' + name + '.js')) return 'lib:' + name;
        if (has(name + '.js')) return 'lib:' + name;
        parts.pop();
      }
      return 'test:' + spec[1];
    }

    if (p === 'sw.js' || p === 'manifest.json' || p === 'icon.svg') return 'pwa';

    const page = /^([^/]+)\.html$/.exec(p);
    if (page) return 'page:' + page[1];

    if (/^docs\//.test(p)) return 'docs:' + (p.split('/')[1] || '');
    if (/\.md$/.test(p)) return 'docs:' + p.replace(/\.md$/, '');
    if (/^\.github\//.test(p)) return 'ci:' + (p.split('/')[1] || '');

    const dir = p.includes('/') ? p.slice(0, p.indexOf('/')) : p;
    return 'other:' + dir;
  }

  function groupIntoUnits(files) {
    const changedPaths = new Set((files || []).map((f) => f.path));
    const byKey = new Map();
    (files || []).forEach((file) => {
      const key = unitKey(file.path, changedPaths);
      if (!byKey.has(key)) byKey.set(key, { key, files: [], changed: 0 });
      const unit = byKey.get(key);
      unit.files.push(file);
      unit.changed += file.changed || 0;
    });
    return [...byKey.values()];
  }

  // First-fit-decreasing over whole units. A unit bigger than the limit cannot
  // be placed without breaking cohesion, so it is reported instead of packed.
  function planSplit(files, options) {
    const limit = (options && options.limit) || LIMIT;
    const units = groupIntoUnits(files).sort(
      (a, b) => b.changed - a.changed || a.key.localeCompare(b.key),
    );
    const parts = [];
    const oversized = [];

    units.forEach((unit) => {
      if (unit.changed > limit) {
        oversized.push(unit);
        return;
      }
      const home = parts.find((part) => part.changed + unit.changed <= limit);
      if (home) {
        home.units.push(unit);
        home.changed += unit.changed;
      } else {
        parts.push({ units: [unit], changed: unit.changed });
      }
    });

    parts.forEach((part) => {
      part.units.sort((a, b) => a.key.localeCompare(b.key));
      part.files = part.units.flatMap((u) => u.files.map((f) => f.path)).sort();
    });

    return { limit, total: totalChanged(files), parts, oversized, units };
  }

  function formatPlan(plan) {
    const lines = [`Changed lines: ${plan.total} (budget ${plan.limit})`];
    if (plan.total <= plan.limit) {
      lines.push('Within budget — auto_merger can take this as one PR.');
      return lines.join('\n');
    }
    lines.push(`Over budget — proposed split into ${plan.parts.length} PR(s):`);
    plan.parts.forEach((part, i) => {
      lines.push('', `PR ${i + 1} — ${part.changed} lines`);
      part.files.forEach((f) => lines.push(`  ${f}`));
    });
    if (plan.oversized.length) {
      lines.push('', 'Needs a manual, commit-by-commit split (single unit over budget):');
      plan.oversized.forEach((u) => lines.push(`  ${u.key} — ${u.changed} lines`));
    }
    return lines.join('\n');
  }

  return { LIMIT, parseNumstat, totalChanged, unitKey, groupIntoUnits, planSplit, formatPlan };
});
