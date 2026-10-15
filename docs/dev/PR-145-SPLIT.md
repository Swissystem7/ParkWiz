# Splitting PR #145 (Refs #148)

`auto_merger` only merges PRs of at most **400 changed lines** (additions +
deletions). [#145](https://github.com/Swissystem7/ParkWiz/pull/145) — the
CityZone / Park Atidim operator demo — is **874**, so it can never merge as
one piece. It is split into three PRs, each off `master`, each under the cap
and each worth merging on its own.

PR #145's head commit is `476d614` (`refs/pull/145/head`, local
`origin/claude/ParkWiz-144-20261015-002637`). Every file below is that commit's
version unless the notes say otherwise.

| # | Slice | Paths | Changed lines | Needs | Status |
|---|-------|-------|---------------|-------|--------|
| 1 | **Demo lot model + opt-in chart marker** (this PR) | `src/lib/atidim-lot.js`, `src/lib/occupancy.js`, `test/atidim-model.test.js`, `test/compare.test.js`, this file | ~365 | — | this PR |
| 2 | **Hebrew RTL operator demo page + offline shell** | `demo/atidim.html`, `sw.js`, `test/sw-precache.test.js`, `test/atidim-demo-page.test.js` | ~372 | 1 | landed |
| 3 | **Page boot tests + presenter playbook** | `test/atidim-lot-camera-views.test.js`, `docs/launch/CITYZONE-ATIDIM.md` | ~247 | 2 | landed |

Totals are additions + deletions, i.e. the number `auto_merger` checks.

**Slices 2 and 3 landed ahead of this one**, via #154 and #157 rather than as
literal slices of #145: `master` now has `demo/atidim.html`, its `sw.js`
precache entries, `docs/launch/CITYZONE-ATIDIM.md` and the page/camera tests.
The page there inlines its own data instead of fetching
`demo/atidim-data.json`, and it drives the *operator* model
(`getHourlyCurve`, `createCameraSpots`) rather than the demo model below — so
slice 1 is still unlanded and still worth landing: it is what any page needs to
render a lot with no camera hardware attached. See
[PR-149-CONFLICTS.md](PR-149-CONFLICTS.md) for how slice 1 was merged with that
later work.

## Why these seams

The page cannot ship before the model it calls (`LOT.snapshotAt`,
`OCC.chartSvg({markIndex})`), and the boot tests cannot ship before the page
they boot — so the three land in order rather than in parallel. Each is still
independently reviewable and independently useful:

1. **Slice 1** adds the 18-bay synthetic demo lot (deterministic hourly curve,
   monotone bay fill) alongside the existing real 220-space operator model, plus
   an opt-in `markIndex` marker on the shared occupancy chart. Reusable by any
   page; nothing else in the repo changes behaviour. It also widened
   `test/compare.test.js`, which asserted `parsePairs('')` throws while
   `src/lib/compare.js` has returned `[]` since #117. `master` was red on that
   test when this was written; #162 has since fixed it there the narrow way
   (assert `null` throws), and this slice keeps the wider version — blank text
   returns `[]`, a non-string throws.
2. **Slice 2** is the demo page itself plus its precache entries, so the page is
   openable (including offline / GitHub Pages) the moment it merges. It also
   un-breaks the links in `docs/CITYZONE_ATIDIM_PITCH.md`, which already pointed
   at `demo/atidim.html` before any file existed there.
3. **Slice 3** is the regression net and the meeting script for the page.

## What is left

Only slice 1 (this PR). Slices 2 and 3 are on `master` already — don't rebuild
them from `refs/pull/145/head`, you would re-add a second demo page.

Two things #145 wanted are still not on `master`, and are deliberately **out of
this PR's scope** so slice 1 stays a pure model change:

- **The demo page does not use the demo model yet.** `demo/atidim.html` renders
  the real 220-space lot. Wiring it (or a second plan-view panel) to
  `snapshotAt` / `bayLayout` and passing `markIndex` to `OCC.chartSvg` is a
  follow-up, and is the reason this slice exports them.
- **No cache bump.** #145 moved `sw.js` to `parkwiz-field-v11`; `master` is at
  `v10` and already precaches `demo/atidim.html`, so nothing is stale. Whoever
  wires the page up should bump it then, with
  `test/sw-precache.test.js`'s floor.

## Verification

Slice 1 on top of `master`: `npm test` → 341 tests, 0 failures.

#145 can be closed once this merges; slices 2 and 3 of its content already
shipped as #154 and #157.
