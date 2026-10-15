# PR #184 — merge conflict with `master`, resolved by hand (Refs #191)

`auto_merger` could not merge
[PR #184](https://github.com/Swissystem7/ParkWiz/pull/184)
(branch `claude/ParkWiz-183-20261015-140028`, head `31d5232`); GitHub reported a
conflict with `master` and update-branch failed.

- merge base: `a134724`
- `master`: `39ca322`
- PR head: `31d5232` — `docs/dev/PR-179-SPLIT.md` +119, `src/lib/atidim-lot.js`
  +168 −3, `test/atidim-board.test.js` +67

## Why it conflicts

PR #184 is **slice 1 of the PR #179 split**: the 18-bay synthetic lot model
added to `src/lib/atidim-lot.js`, plus its four model tests and the split plan.

While #184 sat open, `master` landed *the same model* through a different
split — the "atidim demo" line (#155, #156). Both sides added ~165 lines to the
same place in `src/lib/atidim-lot.js`, immediately after `cameraView()` and
before the `return {}` block, so git sees one large add/add conflict in that
file (plus the same conflict in the export list).

This is not two features fighting. It is **one feature that landed twice**,
under two names:

| | PR #184 | `master` |
|---|---|---|
| what it's called | the *board* model | the *demo* model |
| page it's for | `demo/atidim-board.html` (slice 3 — **never landed**) | `demo/atidim.html` (landed) |
| tests | `test/atidim-board.test.js` | `test/atidim-demo.test.js` |

The four test bodies are **byte-identical** between the two files
(`test/atidim-board.test.js` lines 13–66 ≡ `test/atidim-demo.test.js` lines
17–70); only the first test's title differs (`Atidim board lot uses 18 bays…`
vs `Atidim lot model uses 18 bays…`).

## What PR #184 still had to give

Four things in #184's version of the model are **not** on `master`, and all four
are real improvements. These are what the resolution keeps:

1. **`lotClockParts(date, timeZone)`** — an overridable zone, so a demo page can
   honour the zone that came out of `demo/atidim-data.json` instead of
   hard-coding the lot's own. `master`'s `lotClockParts` takes only a date.
2. **`localHour` goes through `lotClockParts`.** `master`'s `localHour` builds a
   *second* `Intl.DateTimeFormat` inline, which means the demo clock has
   neither of the two fixes the camera clock has:
   - no fallback to host local time when the runtime has no IANA zone data
     (old WebView, `--without-intl` build) — `master`'s version **throws**;
   - no handling of `hourCycle` h24 reporting midnight as `"24"`, so hour 0
     could come back as 24 and `snapshotAt(24)` is off the end of the curve.
3. **`DEFAULT.timezone: LOT_TIME_ZONE`** instead of a second `'Asia/Jerusalem'`
   literal — the two views of the lot can no longer disagree about the hour.
4. **`pad2(h)`** in `hourlySeries` instead of `String(h).padStart(2, '0')` —
   reuses the helper already in the file.

## The resolution, hunk by hunk

Resolved by hand in the worktree, since `git merge` could not be run here.

| conflicting hunk | taken from | why |
|---|---|---|
| file header comment | **`master`** | #184's wording names `demo/atidim-board.html`, which does not exist on `master` (slice 3 never landed). `master`'s wording is the accurate one. |
| `lotClockParts` signature | **#184** | the overridable zone; see (1) above. |
| the 18-bay model block (`DEFAULT` … `liveSnapshot`) | **`master`** | identical code on both sides; `master`'s is the one already shipping behind `demo/atidim.html`. |
| `DEFAULT.timezone` | **#184** | `LOT_TIME_ZONE`, not a second literal; see (3). |
| `hourlySeries` timestamp | **#184** | `pad2(h)`; see (4). |
| `localHour` body | **#184** | one clock for both views; see (2). |
| `arrivalOrder` comment | **`master`** | same reasoning, "demo hour" vs "board's hour" — matches the header choice. |
| export list + its comments | **`master`** | same exports on both sides; `master`'s comments match the header. |

Net effect on `src/lib/atidim-lot.js`: **13 insertions, 13 deletions** against
`master`. The add/add bulk collapses to nothing because it was duplicate code;
what is left is exactly the four improvements.

### Tests

`test/atidim-board.test.js` is **not** re-added. Its four tests already run on
`master` as `test/atidim-demo.test.js`, byte-for-byte — adding the file back
would duplicate 54 lines of assertions under a second name and pin a page name
(`atidim-board`) that no page uses. The file was checked out into the worktree
and run against the resolved model to prove nothing regressed: **4/4 pass.**

In its place, `test/atidim-lot-clock-zone.test.js` (new, 7 tests) pins the part
of #184 that *is* new and was previously untested on either side:

- `DEFAULT.timezone === LOT_TIME_ZONE`, and `localHour` agrees with `lotHour`;
- the zone override — `UTC` → 07, `America/New_York` → 03, default → 10 for the
  same instant, while `formatLotClock` still reads the lot's own zone;
- a site config's `timezone` flowing through `liveSnapshot`;
- midnight is hour 0, never 24;
- an unusable zone falls back to host local time instead of throwing;
- a bad clock input is hour 0, not `NaN`;
- `hourlySeries` timestamps stay two-digit and `Date`-parseable.

Those seven would all have been missing had the conflict been resolved by
simply taking `master`'s side.

### Documents

`docs/dev/PR-179-SPLIT.md` is carried over as #184 wrote it, with a status
banner at the top correcting the three claims `master` has since invalidated
(slice 1 and slice 2 landed elsewhere; the 337-test verification table is now
358). The sizing method and the per-slice reasoning are what is still worth
reading, and slices 3–6 are still unlanded.

## Verified

| state | `npm test` |
|---|---|
| `master` (`39ca322`) | 358 pass, 0 fail |
| resolved merge | **365 pass, 0 fail** |
| #184's own `test/atidim-board.test.js`, run against the resolved model | 4 pass, 0 fail |

## Hand-off — pushing to PR #184's branch

This worktree cannot run network `git` or `gh`, so the merge commit has to be
made and pushed from a checkout that can. **No force push, no new PR**: the
commit below is an ordinary merge of `master` into the PR branch, and the
resolution is the tree this branch carries.

```sh
git fetch origin
git checkout claude/ParkWiz-183-20261015-140028
git merge origin/master            # stops with the conflict described above
# Take the resolved files from this branch:
git checkout claude/ParkWiz-191-20261015-145538 -- \
  src/lib/atidim-lot.js \
  docs/dev/PR-179-SPLIT.md \
  docs/dev/PR-184-CONFLICT-RESOLUTION.md \
  test/atidim-lot-clock-zone.test.js
# #184's duplicate test file: its assertions already live in
# test/atidim-demo.test.js on master, so drop it rather than resolve it.
git rm -f test/atidim-board.test.js
npm test                           # expect 365 pass, 0 fail
git commit -m "Merge master into #184: the atidim board model landed on master as the demo model

master landed the same 18-bay model via #155/#156, so the add/add conflict in
src/lib/atidim-lot.js collapses to the four clock improvements #184 still had
to give: lotClockParts(date, timeZone), a localHour that goes through it (and
so gets the no-Intl fallback and the midnight-as-24 fix), DEFAULT.timezone
named from LOT_TIME_ZONE, and pad2 reuse. #184's four model tests already run
on master as test/atidim-demo.test.js byte-for-byte; the new behaviour is
pinned by test/atidim-lot-clock-zone.test.js instead.

See docs/dev/PR-184-CONFLICT-RESOLUTION.md. Refs #191"
git push origin claude/ParkWiz-183-20261015-140028
```

After the push, #184 should go mergeable and its diff against `master` becomes
the four improvements, the two documents and the new test file — well inside
`auto_merger`'s 400-line limit.
