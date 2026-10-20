# PR #254 — conflict resolution (Refs #259)

`auto_merger` could not merge [PR #254](https://github.com/Swissystem7/ParkWiz/pull/254)
(`factory/laptop-agy-rent-modal-a11y`), and GitHub's update-branch failed. This
documents what actually conflicted, how each conflict was resolved, and how to
land the result on the PR branch.

## Why it conflicted

| | |
|---|---|
| merge base | `63b4bf9` (`dashboard: add empty states, accessible status region, and a11y labels (#221)`) |
| PR head | `875bb35` (`rent: add dialog a11y, close button, backdrop click dismiss, escape key handler, and UI tests`) |
| `master` | `7f95d54` (`factory: Claude loop on ParkWiz#270 (#293)`) |

PR #254 is a single commit touching three paths: `index.html`, `sw.js` and a new
`test/rent-ui-a11y.test.js`. Between the merge base and `master`, the sibling
a11y work for the **pricing** overlays landed, and it reached for the same two
seams the rent PR reaches for:

| path | kind |
|---|---|
| `index.html` | content — both sides add a global `Escape` keydown listener at the same spot, immediately after `activatePremium()` |
| `sw.js` | content — both bump `CACHE`; the PR wrote `v18`, `master` has since gone to `v19` |
| `test/rent-ui-a11y.test.js` | PR-only, no conflict |

The rent modal's own markup — `openRent()`'s template and the `#rentOverlay`
block near the end of the file — is byte-identical between the merge base and
`master`, so those hunks applied cleanly. Only the shared listener and the
shared cache constant are genuinely contested.

## The one real decision: one `Escape` handler, not two

`master`'s listener (from the pricing a11y work) is:

```js
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const pricing = document.getElementById('parkPricingOverlay');
    if (pricing && pricing.classList.contains('show')) { closeParkPricing(); return; }
    const lock = document.getElementById('premiumLockOverlay');
    if (lock && lock.classList.contains('show')) { closeLockModal(); return; }
  }
});
```

PR #254 adds a second, structurally identical listener for `#rentOverlay`.
Taking both sides literally would register two global listeners, and each one's
`return` only guards its *own* chain — so a single `Escape` with two overlays
stacked would close both. The resolution folds the PR's branch into `master`'s
listener as the **first** check: the rent dialog is the one with
`aria-modal="true"`, so when it is open it is the thing `Escape` should dismiss.
`master`'s pricing and lock branches keep their order and behaviour.

`test/rent-ui-a11y.test.js` gained one assertion for this — that the file
registers exactly one `window.addEventListener('keydown')` — so a future sibling
PR cannot silently re-introduce the second handler.

## Resolution, file by file

| path | resolution |
|---|---|
| `index.html` — `openRent()` | PR's version verbatim: `#rentTitle` + `#rentCloseBtn` header row, `<label for="rentHours">`, `aria-label` on the hours select and the terms checkbox, `role="status" aria-live="polite"` on `#rentCalc`, ids and `aria-label`s on the three simulated card inputs, and `ביטול` promoted from a clickable `<b>` to a real `<button id="rentCancelBtn">`. |
| `index.html` — `closeRent()` | PR's version verbatim, including the backdrop guard (`e.target` must be the overlay itself, or inside the close/cancel button). |
| `index.html` — `payRent()` | PR's version: the inline `classList.remove('show')` becomes `closeRent()`. |
| `index.html` — `Escape` listener | **Merged**, not duplicated — see above. Rent branch first, then `master`'s pricing and lock branches. |
| `index.html` — `#rentOverlay` markup | PR's version verbatim: `onclick="closeRent(event)"`, `role="region"`, the Hebrew `aria-label`, and the inner `.rent-box` with `role="dialog" aria-modal="true" aria-labelledby="rentTitle"`. The stray `<!-- Auth Modal -->` comment sitting above the rent overlay moves down to the auth overlay it actually describes. |
| `sw.js` | `master`'s `v19` → **`v20`**, not the PR's `v18`. `index.html` changed again after `master`'s own bump, and the shell is cache-first, so the version has to move forward from `master` rather than backward to the PR's number. |
| `test/rent-ui-a11y.test.js` | PR's file, with two changes. The cache assertion was an exact pin (`const CACHE = 'parkwiz-field-v18';`) — exactly the thing that made this conflict unresolvable by `auto_merger` — and is now a floor (`>= 20`), matching how every other cache test in `test/` is written. One test added for the single-listener invariant. |

Hebrew UI strings are unchanged from the PR. Nothing from PR #254 was dropped.

## Verification

```
$ npm test
# tests 538
# pass 538
# fail 0
```

528 before (`master`), 538 after — 10 new tests, no regressions. The sibling
`test/pricing-ui-a11y.test.js` pins the order of `master`'s listener
(`Escape` … `closeParkPricing()` … `closeLockModal()`); inserting the rent branch
ahead of both keeps that assertion passing. `test/site-preset.test.js` and
`test/spot-freed-events.test.js` hold `>= 19` cache floors, which `v20` clears.

## Landing it on PR #254

This sandbox cannot run `git fetch`, `git merge` or `git push`, so the work is a
plain working-tree change on top of `7f95d54` rather than a merge commit. Its
tree is the resolved merge result, so either of these lands it:

```bash
# A — merge master into the PR branch and take this tree as the resolution
git checkout factory/laptop-agy-rent-modal-a11y
git merge master                      # conflicts in index.html and sw.js, as reported
git checkout <this-branch> -- index.html sw.js test/rent-ui-a11y.test.js
git add -A && git commit              # completes the merge commit
git push origin factory/laptop-agy-rent-modal-a11y
```

```bash
# B — cherry-pick this commit onto the PR branch after merging master
git checkout factory/laptop-agy-rent-modal-a11y
git merge -X theirs master
git cherry-pick <this-commit>
git push origin factory/laptop-agy-rent-modal-a11y
```

No force push and no new PR either way; PR #254 becomes mergeable once the
branch contains this tree.

## Status (2026-10-20, #312) — landed via #295, nothing left to split

#312 asked to rebase #254 and split it into parts of at most 400 changed lines.
There is nothing to split: #254 is 93 changed lines (+79 −14), under the limit
on its own, and the resolved tree above already landed on `master` in **#295**
(`578783e`, the #259 loop). Checked against `master` at `ac88d16`:

- every hunk of `875bb35` is present in `index.html` — `#rentTitle` /
  `#rentCloseBtn`, `<label for="rentHours">`, `role="status"` on `#rentCalc`,
  the three card-input `aria-label`s, `#rentCancelBtn`, `closeRent()` with its
  backdrop guard, and `#rentOverlay` / `.rent-box` with `role="dialog"
  aria-modal="true"`;
- `index.html` still registers exactly one `window.addEventListener('keydown')`;
- `sw.js` is at `v23`, past the `>= 20` floor in `test/rent-ui-a11y.test.js`;
- `npm test`: 598 pass, 0 fail (`test/rent-ui-a11y.test.js`: 10 / 10).

Re-applying #254 today would be an empty diff, so #254 should be closed as
superseded rather than rebased. Close comment:

```md
Closing as superseded: this PR's change (rent modal dialog a11y, close/cancel
buttons, backdrop dismiss, Escape handler, UI tests) already landed on master
in #295, with the Escape handler folded into the existing listener and the
cache bumped past v18. Details in
[`docs/dev/PR-254-CONFLICT-RESOLUTION.md`](../../blob/master/docs/dev/PR-254-CONFLICT-RESOLUTION.md).
Nothing from this PR is missing on master; no split needed (93 lines < 400).
```

Do not delete `factory/laptop-agy-rent-modal-a11y` before #254 is closed; after
that it is safe, since nothing on `master` refers to `875bb35`.
