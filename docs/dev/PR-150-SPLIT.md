# Splitting PR #150 into auto_merger-sized PRs

`auto_merger` merges PRs of at most **400 changed lines** (additions + deletions).
PR #150 is `10 files changed, 897 insertions(+), 3 deletions(-)` = **900 changed
lines**, so it can never merge as one piece. Refs #151.

PR #150 head: `78e6be8c7ecb7eda630c8af76e663f12b88e30e1`
(branch `origin/claude/ParkWiz-141-20261015-023437`). Every command below
assumes that sha is still reachable; it is, as long as #150 is not deleted.

## What PR #150 contains

| file | +/- | layer |
|------|-----|-------|
| `src/lib/occupancy.js` | +11 | shared chart helper — opt-in `markIndex` marker |
| `test/compare.test.js` | +7 −1 | unrelated: fixes an assertion that is **red on master** |
| `src/lib/atidim-demo-lot.js` | +163 | new 18-bay synthetic demo lot model |
| `test/atidim-demo.test.js` | +129 | mixes three layers: model, chart marker, page+sw |
| `demo/atidim.html` | +310 | Hebrew RTL operator demo page (canvas lot + counters) |
| `demo/atidim-data.json` | +7 | site config the page fetches |
| `test/atidim-page.test.js` | +210 | boots the page's inline script against a stub DOM |
| `sw.js` | +4 −1 | precache the demo shell, cache bump v9 → v11 |
| `test/sw-precache.test.js` | +3 −1 | require the bump |
| `docs/launch/CITYZONE-ATIDIM.md` | +53 | meeting runbook for the demo |

## The slices

Sizes are measured, not estimated: each slice below was materialized in a
worktree and `npm test` was run on top of the slices before it.

| # | PR | changed lines | needs |
|---|----|---------------|-------|
| 1 | shared chart marker + red-test fix (**this PR**) | 80 + 207 doc | — |
| 2 | `src/lib/atidim-demo-lot.js` + model tests | 241 | — |
| 3 | `demo/atidim.html` + data + offline shell + static test | 374 | 1, 2 |
| 4 | `test/atidim-page.test.js` — page behaviour test | 210 | 3 |
| 5 | `docs/launch/CITYZONE-ATIDIM.md` — meeting runbook | 53 | 3 |

Total 958 against #150's 900: splitting `test/atidim-demo.test.js` costs a
second set of `require` headers, and slice 1 replaces one bundled assertion
with a focused test file.

Slices 1 and 2 are independent of each other and of everything else. Slices
3–5 are genuinely ordered, not artificially so — a page cannot precede the
library it loads, and a test of a page cannot precede the page. Ship them in
order; each is a working, reviewable state of the repo.

### Slice 1 — shared chart marker + red-test fix (this PR)

Shipped as code on this branch.

- `src/lib/occupancy.js` — `chartSvg(records, { markIndex })` draws a dashed
  line and a dot on one record. Opt-in: no `markIndex`, byte-identical SVG, so
  the pilot kit/report/dashboard pages are untouched. `typeof o.markIndex ===
  'number'` rather than `Number(...)`, because `Number(null)` is `0` and would
  mark midnight on every existing caller.
- `test/occupancy-chart-mark.test.js` — new, 61 lines. Covers the opt-in
  default, marker position landing on the curve, stroke inheritance, and that
  `-1 / 24 / 1.5 / NaN / null / '10' / true / {}` draw nothing. Replaces the
  `chart marker calls out one hour and is opt-in` case that PR #150 had buried
  in `test/atidim-demo.test.js`, and does not need the demo lot module.
- `test/compare.test.js` — `master` asserts `parsePairs('')` throws
  `TypeError`, but `src/lib/compare.js` returns `[]` for blank input (by
  design — `replacePairsFromText` depends on it). **`npm test` on master is
  currently 313/314 with that one failure.** PR #150 fixed it in passing; it
  is 8 lines and unblocks CI for every slice below, so it rides along here
  rather than waiting behind the Atidim work.

### Slice 2 — demo lot model

```sh
git checkout master -b atidim-demo-lot
git checkout 78e6be8 -- src/lib/atidim-demo-lot.js
```

Then split PR #150's test file, keeping only the model half:

```sh
git show 78e6be8:test/atidim-demo.test.js > /tmp/atidim-demo.test.js
# keep lines 14-82 (the five model tests) under a trimmed header:
#   test / assert requires, then
#   const lot = require('../src/lib/atidim-demo-lot');
#   const occ = require('../src/lib/occupancy');
# drop lines 1-13 fs/path/sw/htmlPath/dataPath setup, 83-95 (chart marker,
# shipped in slice 1) and 96-130 (page + sw, slice 3).
```

Result: 163 + 78 = **241** changed lines. `npm test` green on master + slice 1.

The five kept tests are model-only: 18 bays, business-hours peak, 24-hour
series into `occ.chartSvg`/`occ.byHour`, the monotone scatter `bayLayout`,
`snapshotAt`/`liveSnapshot`, and the global-collision check against the
220-bay operator model in `src/lib/atidim-lot.js` (#120). None of them read
`demo/atidim.html`, so the slice stands alone.

### Slice 3 — the demo page and its offline shell

```sh
git checkout master -b atidim-demo-page   # after slices 1-2 are in master
git checkout 78e6be8 -- demo/atidim.html demo/atidim-data.json sw.js test/sw-precache.test.js
```

Plus the page's static test, lines 96-130 of PR #150's
`test/atidim-demo.test.js` (the `Hebrew RTL operator demo page …` and
`service worker precaches …` cases) as a new file
`test/atidim-page-shell.test.js` with an `fs`/`path`/`root`/`sw`/`htmlPath`/
`dataPath` header — 48 lines.

Result: 310 + 7 + 48 + 5 + 4 = **374** changed lines.

Two things must stay in this slice together:

- The `sw.js` cache bump (`parkwiz-field-v9` → `v11`) and the
  `v >= 11` assertion in `test/sw-precache.test.js`. The shell is cache-first,
  so without the bump a laptop that already opened ParkWiz keeps serving the
  stale asset list on the morning of the meeting.
- `demo/atidim-data.json`, because `sw.js` precaches it and
  `every precached asset exists on disk` fails if it is listed but absent.

Worth knowing while reviewing: `test/sw-precache.test.js`'s
`every same-origin file a page fetches at runtime is precached` only walks
`fs.readdirSync(root)` for `*.html`, so it never sees `demo/atidim.html` or
its `fetch("atidim-data.json")`. That is why PR #150 asserted the three new
precache entries by hand. Teaching that guard to recurse into `demo/` is a
good follow-up, but it belongs in its own PR — it would touch every page.

### Slice 4 — page behaviour test

```sh
git checkout master -b atidim-page-test   # after slice 3 is in master
git checkout 78e6be8 -- test/atidim-page.test.js
```

**210** changed lines, verbatim from PR #150. Boots the page's inline script in
`node:vm` against a stub DOM and a fake canvas context, the same shape as
`test/pwa-appinstalled.test.js`, with `Date` pinned to
`2026-10-19T07:30:00Z` (10:30 in Jerusalem). It is the slice that catches a
blank canvas, an unwired scrubber, a `roundRect`-less browser, and the
`file://` fetch fallback — i.e. the failures that would otherwise happen live
in the CityZone meeting. It cannot precede slice 3, which is why it is its own
PR rather than part of it: 374 + 210 is over the limit.

### Slice 5 — meeting runbook

```sh
git checkout master -b atidim-launch-doc   # after slice 3 is in master
git checkout 78e6be8 -- docs/launch/CITYZONE-ATIDIM.md
```

**53** changed lines. Hebrew runbook: what to show, the 3-minute script, what
the demo is *not*, and why there are two Atidim models in `src/lib`. Its links
point at `demo/atidim.html`, so it follows slice 3. Pairs with the existing
`docs/launch/PITCH.md` and `docs/CITYZONE_ATIDIM_PITCH.md`.

## Verification done for this split

From a worktree on `master` + slice 1:

1. Materialized slices 2–5 (`git show 78e6be8:<path>` into place, including the
   `sw.js` patch) → `npm test` **337/337 pass**. Confirms slice 1's `markIndex`
   is exactly what `demo/atidim.html` calls and what PR #150's page test
   asserts.
2. Swapped in the split `test/atidim-demo.test.js` (78 lines) and
   `test/atidim-page-shell.test.js` (48 lines) → **336/336 pass**. Confirms the
   test split loses no coverage (the missing case moved to
   `test/occupancy-chart-mark.test.js` in slice 1, which adds six).
3. Removed slices 2–5 again → **320/320 pass** on slice 1 alone, up from
   master's 313/314.

## Hand-off

This branch carries slice 1 only. Slices 2–5 need a push per branch, which
this worktree cannot do. After this PR merges:

```sh
# per slice, from a checkout that can push:
git checkout master && git pull
git checkout -b <slice-branch>
# ...the checkout commands from the slice above...
npm test
git commit -am "<slice message>" && git push -u origin <slice-branch>
gh pr create --fill --base master
```

Then close #150, pointing at the replacements:

```sh
gh pr close 150 --comment "$(cat <<'EOF'
Closing in favour of smaller PRs: this one is 900 changed lines and
auto_merger merges at most 400 (#151).

Split into, in order:

- #<n1> — shared `chartSvg({ markIndex })` marker + the stale
  `test/compare.test.js` assertion that is red on master (80 lines)
- #<n2> — `src/lib/atidim-demo-lot.js` + model tests (241 lines)
- #<n3> — `demo/atidim.html`, `demo/atidim-data.json` and the offline shell
  (374 lines)
- #<n4> — `test/atidim-page.test.js`, the page behaviour test (210 lines)
- #<n5> — `docs/launch/CITYZONE-ATIDIM.md`, the meeting runbook (53 lines)

Nothing is dropped; the plan and the per-slice checkout commands are in
`docs/dev/PR-150-SPLIT.md`. #<n1> and #<n2> are independent; #<n3>-#<n5>
need the ones before them.
EOF
)"
```
