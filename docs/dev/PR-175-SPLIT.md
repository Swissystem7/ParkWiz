# Splitting PR #175 (Refs #178)

`auto_merger` only merges PRs of at most **400 changed lines** (additions +
deletions). [#175](https://github.com/Swissystem7/ParkWiz/pull/175) is **458**,
so it can never merge as one piece.

#175 is a bundle, not one change: it carries the Atidim demo lot model, an
unrelated option on the shared occupancy chart, an unrelated `compare` test
assertion, and two write-ups of *earlier* splits. Those four things have no
code in common, so this is a clean split rather than a sequenced one.

| | |
|---|---|
| PR head | `claude/ParkWiz-172-20261015-132035` @ `ff62c01` |
| Merge base | `d700834` — **identical to `master`**, so nothing here is stale |
| `master` baseline | `npm test` → 337 tests, 0 failures |
| All four slices applied together | `npm test` → **349 tests, 0 failures** |

## The slices

| # | Slice | Paths | Changed lines | Needs | Status |
|---|-------|-------|---------------|-------|--------|
| 1 | **Opt-in hour marker on the occupancy chart** (this PR) | `src/lib/occupancy.js`, `test/occupancy-chart-marker.test.js`, this file | 77 + doc | — | this PR |
| 2 | **Atidim demo lot model** | `src/lib/atidim-lot.js`, `test/atidim-model.test.js` | 259 | — | to open |
| 3 | **`parsePairs` treats blank text as a no-op** | `test/compare.test.js` | 6 | — | to open |
| 4 | **Split / conflict write-ups for #145 and #149** | `docs/dev/PR-145-SPLIT.md`, `docs/dev/PR-149-CONFLICTS.md` | 169 | — | to open |

Totals are additions + deletions, i.e. the number `auto_merger` checks. They
sum to 511 rather than 458 because slice 1's test is rewritten standalone
(66 lines) instead of riding along as a 13-line block inside slice 2's test
file — see "Why the test file had to be split" below.

**Every slice is independent.** None needs another to land first, and the
order below is just convenience. That is unusual for these splits (#145 and
#149 both had a page-depends-on-library chain) and it is only true because
`chartSvg`'s new option is additive and defaults to off.

## Slice 1 — opt-in hour marker (shipped here)

`chartSvg` gains a `markIndex` option: a dashed vertical rule plus a dot on
one record, so an operator page showing "now: 11 of 18 bays" can point at the
matching point on the curve instead of leaving the reader to count gridlines.
Off by default, so every existing chart renders byte-identically.

The one subtlety worth reviewing is the guard:

```js
const mi = typeof o.markIndex === 'number' ? o.markIndex : -1;
if (Number.isInteger(mi) && mi >= 0 && mi < n) { … }
```

`typeof`, not `Number()` — `Number(null)` is `0`, so a coercing guard would
draw a marker on **midnight** for every caller that passes a missing index
straight through. `test/occupancy-chart-marker.test.js` pins that case, along
with out-of-range and fractional indices, and asserts the dot lands exactly on
the curve point rather than near it (it reads the k-th coordinate out of the
path's `d` attribute and compares).

### Why the test file had to be split

#175 tests the marker from inside `test/atidim-model.test.js`, building its
series with `lot.hourlySeries(lot.DEFAULT)`. That couples a change in
`src/lib/occupancy.js` to a change in `src/lib/atidim-lot.js` for no reason —
the chart does not know what an Atidim bay is. Slice 1's test therefore builds
its own 24-row synthetic series and drops the `atidim-lot` require, which is
what makes slices 1 and 2 independent instead of ordered.

## Opening the remaining slices

All commands are run from a normal clone with `origin` fetched, on a branch
off `master`. `ff62c01` is #175's head.

### Slice 2 — Atidim demo lot model (259 lines)

```sh
git switch -c split/175-atidim-demo-model master
git checkout ff62c01 -- src/lib/atidim-lot.js test/atidim-model.test.js
```

Then **delete one test block** from `test/atidim-model.test.js`: the whole
`test('chart marker calls out one hour and is opt-in', …)` call, from that line
down to (not including) `test('the operator model is untouched by the demo
model', …)`. That is 13 lines, and it ships in slice 1 instead. Leave the
`require('../src/lib/occupancy')` at the top — the surviving
`hourly series feeds the shared occupancy chart` test still uses `occ.chartSvg`
and `occ.byHour`, with no `markIndex`, so it passes with or without slice 1.

The file should be 87 lines afterwards. `npm test` → 343 tests, 0 failures
(349 if slice 1 is already on `master`).

What it adds: an 18-bay synthetic lot (`DEFAULT`, `stateAt`, `bayLayout`,
`snapshotAt`, `hourlySeries`, `localHour`, …) alongside the existing real
220-space operator model, with a header comment explaining why both live in one
file. Reviewer's attention is worth spending on two deliberate near-duplicates:
`bayLayout` hash-scatters arrivals where `bayStates` fills left-to-right (a
solid block reads as obviously fake on screen, and the fixed order keeps the
fill monotone so scrubbing the hour makes cars arrive rather than teleport),
and `localHour` returns hour 0 for an unreadable date where the operator
model's `lotHour` falls back to the wall clock.

### Slice 3 — `parsePairs` blank-text assertion (6 lines)

```sh
git switch -c split/175-parsepairs-blank master
git checkout ff62c01 -- test/compare.test.js
```

Adds four assertions to the existing `an empty or pair-less file keeps the
saved pairs` test: `parsePairs('')` and `parsePairs('   \n')` return `[]`, and
`parsePairs(undefined)` throws like `parsePairs(null)` already does. Test-only,
and it closes the gap `4da26aa` left — that commit pinned the non-string throw
but not the blank-string no-op that `replacePairsFromText` depends on.

### Slice 4 — split / conflict write-ups (169 lines)

```sh
git switch -c split/175-dev-writeups master
git checkout ff62c01 -- docs/dev/PR-145-SPLIT.md docs/dev/PR-149-CONFLICTS.md
```

Docs only, no test impact. `docs/dev/PR-145-SPLIT.md` is the #145 → three-PR
slice table (Refs #148) and `docs/dev/PR-149-CONFLICTS.md` is the #149
conflict resolution write-up (Refs #172). Both describe work that has since
landed, so they are history rather than instructions — worth keeping for the
next person who has to re-split an Atidim PR, which is now the fourth time.

## Closing #175

Once the three branches above are pushed and opened, close #175 with:

```sh
gh pr close 175 --comment "$(cat <<'EOF'
Superseded — split into independent PRs off `master`, each under
`auto_merger`'s 400-changed-line cap (this one was 458). Every slice stands on
its own and none depends on another:

- #<slice1> — opt-in hour marker on the occupancy chart (`markIndex`) — 77 lines
- #<slice2> — Atidim demo lot model — 259 lines
- #<slice3> — `parsePairs` blank-text no-op assertion — 6 lines
- #<slice4> — split / conflict write-ups for #145 and #149 — 169 lines

All four applied together: `npm test` → 349 tests, 0 failures.
Rationale and the exact per-slice commands are in `docs/dev/PR-175-SPLIT.md`
(Refs #178).
EOF
)"
```

Substitute the real PR numbers for `#<sliceN>` before running it.
