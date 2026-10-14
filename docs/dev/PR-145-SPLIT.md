# Splitting PR #145 (Refs #148)

`auto_merger` only merges PRs of at most **400 changed lines** (additions +
deletions). [#145](https://github.com/Swissystem7/ParkWiz/pull/145) — the
CityZone / Park Atidim operator demo — is **874**, so it can never merge as
one piece. It is split into three PRs, each off `master`, each under the cap
and each worth merging on its own.

PR #145's head commit is `476d614` (`refs/pull/145/head`, local
`origin/claude/ParkWiz-144-20261015-002637`). Every file below is that commit's
version unless the notes say otherwise.

| # | Slice | Paths | Changed lines | Needs |
|---|-------|-------|---------------|-------|
| 1 | **Demo lot model + opt-in chart marker** (this PR) | `src/lib/atidim-lot.js`, `src/lib/occupancy.js`, `test/atidim-model.test.js`, `test/compare.test.js`, this file | ~365 | — |
| 2 | **Hebrew RTL operator demo page + offline shell** | `demo/atidim.html`, `demo/atidim-data.json`, `sw.js`, `test/sw-precache.test.js`, `test/atidim-shell.test.js` | ~372 | 1 |
| 3 | **Page boot tests + presenter playbook** | `test/atidim-page.test.js`, `docs/launch/CITYZONE-ATIDIM.md` | ~247 | 2 |

Totals are additions + deletions, i.e. the number `auto_merger` checks.

## Why these seams

The page cannot ship before the model it calls (`LOT.snapshotAt`,
`OCC.chartSvg({markIndex})`), and the boot tests cannot ship before the page
they boot — so the three land in order rather than in parallel. Each is still
independently reviewable and independently useful:

1. **Slice 1** adds the 18-bay synthetic demo lot (deterministic hourly curve,
   monotone bay fill) alongside the existing real 220-space operator model, plus
   an opt-in `markIndex` marker on the shared occupancy chart. Reusable by any
   page; nothing else in the repo changes behaviour. It also fixes
   `test/compare.test.js`, which asserts `parsePairs('')` throws while
   `src/lib/compare.js` has returned `[]` since #117 — **`master` is red on this
   test today**, so it is folded in here to get the suite green before the rest.
2. **Slice 2** is the demo page itself plus its precache entries, so the page is
   openable (including offline / GitHub Pages) the moment it merges. It also
   un-breaks the links in `docs/CITYZONE_ATIDIM_PITCH.md`, which already points
   at `demo/atidim.html` on `master` — a file nothing has added yet.
3. **Slice 3** is the regression net and the meeting script for the page.

## Building slices 2 and 3

```sh
git fetch origin 'refs/pull/145/head:pr145'      # or use origin/claude/ParkWiz-144-20261015-002637
git switch -c split/145-2-atidim-demo-page origin/master
git checkout pr145 -- demo/atidim.html demo/atidim-data.json sw.js test/sw-precache.test.js
# then add test/atidim-shell.test.js (see notes) and: npm test

git switch -c split/145-3-atidim-page-tests origin/master
git checkout pr145 -- test/atidim-page.test.js docs/launch/CITYZONE-ATIDIM.md
npm test
```

Rebase 2 on `master` after 1 merges, and 3 after 2 merges; the slices touch
disjoint files, so neither rebase conflicts.

## Notes for the slice authors

- **Slice 2 needs its own test.** PR #145 put every Atidim test in one
  `test/atidim-demo.test.js`; its first five tests are the model and now live in
  `test/atidim-model.test.js` (slice 1). Carry the remaining two — the static
  page-shell and service-worker assertions — into a new
  `test/atidim-shell.test.js`: Hebrew `lang`/`dir="rtl"`, the synthetic-data
  banner, the `640x360` canvas attributes, the KPI and `hourRange`/`nowBtn`
  ids, the three Hebrew privacy promises (no plates, no video, edge
  processing), no CDN hosts, and `./demo/atidim.html`,
  `./demo/atidim-data.json`, `./src/lib/atidim-lot.js` present in `ASSETS`.
  Do not re-add the five model tests — they would duplicate slice 1.
- **Slice 2 must keep the cache bump.** `sw.js` goes to `parkwiz-field-v11` and
  `test/sw-precache.test.js` raises its floor to match; without it a laptop that
  already opened the shell serves the stale page on the morning of the meeting.
- **Slice 3's doc overlaps an existing one.** `master` already has
  `docs/CITYZONE_ATIDIM_PITCH.md` (same meeting, same demo link). Prefer folding
  #145's unique part — the 3-minute "how to run the demo" presenter script —
  into that file over adding a second CityZone doc. Hebrew stays Hebrew either
  way.

## Verification

The three slices stacked on `master` are the content of #145 and run green:
`npm test` → 329 tests, 0 failures. Slice 1 alone is also green.

When all three are open, close #145 with a comment listing them.
