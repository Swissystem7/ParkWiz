# PR #68 — split request (Refs #319): superseded, nothing to split

#319 asked to rebase [PR #68](https://github.com/Swissystem7/ParkWiz/pull/68)
on `master`, resolve its conflicts, and split it into parts of at most 400
changed lines. There is nothing to split or rebase: every line of #68 is
already on `master`.

## What #68 is

| | |
|---|---|
| branch | `rc/daily-ParkWiz` |
| head | `2ac615b` (`rc daily ParkWiz: 3 candidates (rebuilt staging, history kept)`) |
| size | 65 changed lines (+65 −0), 6 files — under the 400-line limit on its own |

It is the daily release-candidate bundle of three dev-cycle fixes:

| candidate | path | change |
|---|---|---|
| `4d08e10ce711` | `src/lib/export.js`, `test/export.test.js` | `decodeSharePayload` returns `null` when `n` is negative or not an integer |
| `81131d686fe3` | `src/lib/compare.js`, `test/compare.test.js` | `savePairs` throws `TypeError('list must be an array')` on a non-array |
| `6f4d5cef844c` | `src/lib/feedback.js`, `test/feedback.test.js` | new module exporting `getFeedbackUrl()` (the owner's Google Form) |

## Why it conflicts

The same bundle, with the same 65 lines in the same 6 files, already landed as
**#63** (`7408b07`, `rc: ParkWiz - מועמדים ירוקים מאוחדים (מתעדכן כל יום)`,
2026-10-02). The `rc/daily-ParkWiz` branch was rebuilt afterwards ("history
kept"), so it re-adds hunks that `master` already has and has since changed
around (`compare.js` and `export.js` both grew more validation after #63). Those
re-added hunks are the source of `CONFLICTING`.

## Checked against `master` (`cea3eea`)

- `src/lib/compare.js` — `savePairs` starts with the `Array.isArray(list)` guard
  and the same `TypeError` message.
- `src/lib/export.js` — `decodeSharePayload` has the
  `if (n < 0 || n !== Math.floor(n)) return null;` check right after `const n`.
- `src/lib/feedback.js`, `test/feedback.test.js` — byte-identical to the PR.
- `test/compare.test.js` has `savePairs throws TypeError when list is not an
  array`; `test/export.test.js` has `decodeSharePayload rejects negative count
  values` — both identical to the PR's tests.
- `npm test`: 598 pass, 0 fail.

Rebasing #68 onto `master` would give an empty diff, so a split would only open
empty PRs.

## Close comment for #68

```md
Closing as superseded: all three candidates in this RC (decodeSharePayload
rejects negative/non-integer `n`, savePairs rejects non-arrays, feedback URL
module) already landed on master in #63 with identical code and tests. The
branch was rebuilt after that, which is why it now conflicts. Rebased on
master the diff is empty, so there is nothing to split (65 lines < 400).
Details in
[`docs/dev/PR-68-SPLIT.md`](../../blob/master/docs/dev/PR-68-SPLIT.md).
```

`rc/daily-ParkWiz` is rebuilt by the RC job, so leave the branch alone. Just
close the PR.
