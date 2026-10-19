# PR #249 — conflict resolution (Refs #258)

`auto_merger` could not merge [PR #249](https://github.com/Swissystem7/ParkWiz/pull/249)
(`factory/laptop-agy-calibrate-actions-a11y`), and GitHub's update-branch failed.
This documents what actually conflicted, how each conflict was resolved, and how
to land the result on the PR branch.

## Why it conflicted

| | |
|---|---|
| merge base | `63b4bf9` (`dashboard: add empty states, accessible status region, and a11y labels (#221)`) |
| PR head | `a9fecf3` (`calibrate: add copy summary action, reset calibration, accessible status regions, button guards, and UI tests (#248)`) |
| `master` | `7f95d54` |

This is a **duplicate landing**, not "PR plus unrelated master commits". Between
the merge base and `master`, `cf3716a` — *calibrate: add empty states,
accessible status region, a11y labels, and button guards* (#225) — landed the
same a11y pass over `pilot-calibrate.html` from a different line of
development. PR #249 is an independent implementation of overlapping work, plus
two features #225 never had.

Conflicting paths:

| path | kind |
|---|---|
| `pilot-calibrate.html` | content — both sides rewrote the same panels, guards and `renderSpotList()` |
| `test/calibrate-ui.test.js` | **add/add** — two different test files at the same path |
| `sw.js` | content — both bumped `CACHE` (PR: v17→v18, `master`: v17→v19) |

## What each side had

Only on `master` (#225), kept:

* `#calStatus` — a dedicated `role="status"` live region, written through a
  `setStatus(msg, isError)` helper, with per-action feedback on every load /
  snap / undo / clear / estimate.
* `btnUndo.disabled` / `btnClear.disabled` driven from `state.spots.length`.
* `#spotsEmpty` — the spot-list empty-state paragraph.
* `for=` + `aria-label` on the three file inputs; `aria-label` on `.kpis`,
  `#spotList`; `role="timer"` on `#timer`.

Only on PR #249, added by this resolution:

* **Copy summary** — `#btnCopySummary` + `copySummary()`: an eight-line Hebrew
  calibration summary (site, clock, marked spots, estimated occupied/free,
  lighting, confidence, heuristic disclaimer) to the clipboard.
* **Reset calibration** — `#btnReset` + `resetCalibrate()`: clears the interval,
  clock, images, spots, estimates and KPIs, and returns the wizard to step 1.
* `aria-label` on all fifteen wizard controls (`btnStart`, `btnDemo`,
  `streetName`, `btnSampleSnap`, `btnSampleSpots`, `btnUndo`, `btnClear`,
  `btnSampleEmpty`, `btnSampleNight`, `btnEstimate`, `btnCopySummary`,
  `btnSave`, `btnReset`, `btnPrev`, `btnNext`).
* `role="region"` + `aria-labelledby` on all four wizard panels (with `id`s on
  their `h2`s), `role="region"` on `#stage`, `role="list"` on `#stepList`.
* `role="status" aria-live="polite"` on `#estNote` and `#emptyNote`.
* A per-row `aria-label` (`"מקום 3: תפוס · היוריסטיקה"`) on generated spot rows,
  via a `statusText` local shared with the badge.
* Guard messages on undo / clear, and `.empty-msg` CSS (`master` used the class
  without ever defining the rule).

Nothing from either side was dropped. Where the two sides implemented the *same*
thing differently, `master`'s version stayed and the PR's was folded into it.

## The three reconciliations

Three of PR #249's 41 page assertions do not hold verbatim against the merged
page, because `master` already implemented the same behaviour in a different
shape. The merged test file widens those three to assert the behaviour without
pinning the PR's exact statement layout; the other 38 hold unchanged.

**1. One empty-state paragraph, not two.** #249 called it `#spotListEmpty`
(after the list, `display:none`), #225 called it `#spotsEmpty` (before the list,
`display: block`). Two empty-state notes in one panel would contradict each
other, so the single element keeps `master`'s id, position and wording, and the
test asserts `#spotsEmpty`.

**2. `computeEstimate()` guard.** Both sides use the identical message
("חסרים תמונה או מלבנים לחישוב תפוסה."); `master` additionally mirrors it into
`setStatus(msg, true)`. `master`'s body is kept and the assertion now matches
the message anywhere inside the guard rather than as its only statement.

**3. `savePack()` guard.** Both sides guard the same condition with different
wording. Both are kept and are complementary rather than duplicated: `#estNote`
states the blocker ("אין מלבנים שמורים לשמירת כיול.") and `#calStatus` adds the
next step ("אין מלבנים לשמירה. סמנו לפחות מקום חניה אחד או טענו דוגמה.").

The undo / clear guards needed no reconciliation — `master`'s bare
`if (!state.spots.length) return;` became #249's guard verbatim, on top of
`master`'s `disabled` handling. The `disabled` attribute remains the primary
affordance; the guard is the fallback for a programmatic or AT-driven activation.

## Three small fixes the merge forced

These are not in either side; combining the two sides made them necessary.

* **`#calCanvas` role.** #225 set `role="region" tabindex="0"`, #249 set
  `role="img"`. The canvas is a static overlay of marked rectangles, so
  `role="img"` is correct, and `tabindex="0"` is kept so it stays reachable by
  keyboard: `role="img" aria-label="…" tabindex="0"`.
* **No double announcement in `savePack()`.** `master` ended with
  `setStatus(note.textContent)`, which duplicated the text on screen. Harmless
  while `#estNote` was inert; once #249 makes `#estNote` a live region it would
  be announced twice. `savePack()` now clears `#calStatus` and lets `#estNote`
  carry the result. `computeEstimate()`'s `setStatus(…)` is a *different*
  sentence, so it stays.
* **`resetCalibrate()` feedback has to be visible.** The PR's version set
  `#estNote` and then called `renderSteps()`, which returns to step 1 and hides
  the panel that owns `#estNote` — so the reset confirmed nothing, and a
  `display:none` live region is not announced either. The confirmation now also
  goes to `#timerNote`, which is on screen at every step, and the stale
  `#calStatus` line is cleared. `snapImg.src = ""` became
  `snapImg.removeAttribute("src")`; an empty `src` resolves to the document URL
  and makes the browser request the page itself as an image.

## `sw.js`

The PR bumped `parkwiz-field-v17`→`v18` for its `pilot-calibrate.html` change;
`master` is already at `v19`. `master`'s asset list is taken whole and the cache
goes to **`v20`**, because this merge changes the page shell again and the
service worker is cache-first. Every test pins the version as a floor (`>= 12`,
`>= 19`), so a bump is safe.

## Landing it on the PR branch

This worktree carries the resolution as a normal commit on top of `master`
(network git is unavailable here, so it could not be pushed to the PR branch
directly). To make PR #249 mergeable, redo it as the merge commit it should be —
no force push, no new PR:

```sh
git fetch origin
git checkout factory/laptop-agy-calibrate-actions-a11y
git merge origin/master            # stops with the three conflicts above
# take the resolved files from this branch:
git checkout <this-branch> -- pilot-calibrate.html sw.js test/calibrate-ui.test.js
git checkout <this-branch> -- docs/dev/PR-249-CONFLICT-RESOLUTION.md
git add -A && git commit           # keep the default merge message
npm test
git push origin factory/laptop-agy-calibrate-actions-a11y
```

PR #249 then shows mergeable, and CI runs `refs/pull/249/merge` against a tree
that is byte-identical to this one.

## Verification

* `npm test` — 530/530 pass (`node --test test/*.js`).
* 38 of PR #249's 41 `pilot-calibrate.html` assertions hold verbatim against the
  merged page; the three above are deliberately widened in the merged test file.
* No browser in this environment, so the merged inline script was run in `node`
  against a stub DOM (throwaway harness, not committed). Observed: the copy /
  save / undo / clear guards each produce their Hebrew message; `#btnUndo` is
  `disabled` with no spots and enabled with one; `#spotsEmpty` toggles
  `block`/`none`; `copySummary()` resolves to
  "סיכום הכיול הועתק ללוח."; `resetCalibrate()` leaves `0 spots`,
  `startedAt=null`, `lastLot=null`, `step=0`, an empty `#calStatus`, the reset
  line in `#timerNote`, and no `src` attribute on `#snapImg`.
