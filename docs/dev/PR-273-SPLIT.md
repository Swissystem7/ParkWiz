# PR #273 — split into PRs of at most 400 changed lines (Refs #274)

`auto_merger` merges PRs of at most **400 changed lines** (additions +
deletions). [PR #273](https://github.com/Swissystem7/ParkWiz/pull/273) is
**1393** — three and a half times over.

PR #273 head: `3b72fa3` (branch `origin/claude/ParkWiz-268-20261019-092939`),
cut against `master` at `159babb`, which is still the tip — the PR has no
conflicts, only a size problem. Every `git show` below assumes that sha stays
reachable, which it does as long as the branch is not deleted.

## What PR #273 contains

One feature: the unified Atidim pilot flow from #268 — camera source → occupancy
engine → „התפנה תא” → driver alert with navigation and a hold → the four
Hebrew surfaces (נהג / מנהל חניון / שלט כניסה / הגדרות).

| file | +/− | layer |
|---|---|---|
| `src/lib/pilot-flow.js` | +345 | the spine: bus, settings, sources, clip decode, alert, hold |
| `pilot/sample-clip.json` | +19 | the decoded sample clip the flow runs on |
| `test/pilot-flow.test.js` | +219 | unit tests for the spine (plus a docs/shell block) |
| `demo/pilot.html` | +427 | the one page, four surfaces |
| `test/pilot-e2e.test.js` | +274 | the page's real inline script against a stub DOM |
| `docs/pilot-atidim.md` | +71 | the flow's documentation |
| `sw.js` | +7 −1 | precache the page, the lib and the clip; cache v18 → v19 |
| `src/lib/surface-nav.js` | +3 | the flow in the global Hebrew nav |
| `README.md` | +7 | the flow section and the honesty bullet |
| `docs/launch/CITYZONE-ATIDIM.md` | +7 | the flow opens the CityZone meeting |
| `demo/atidim.html` | +2 | cross-link to the flow |
| `demo/atidim-board.html` | +2 | cross-link to the flow |
| `test/pricing-ui-a11y.test.js` | +7 −2 | unpin the sw cache assertion so v19 can land |

There is no paperwork to cut away here (the usual code-vs-docs seam — see
`PR-194-SPLIT.md` — does not apply): this is one real feature that has to be
sliced along its own layers, and two of its files are over 400 **on their own**.

## The slices

Sizes are measured, not estimated. Per-file numbers come from
`git diff --numstat master...3b72fa3`; the two intra-file cuts were measured by
materialising the line ranges and counting.

| # | slice | paths | changed lines | needs |
|---|---|---|---|---|
| 1 | sw cache assertion becomes a floor (**this PR**) | `test/pricing-ui-a11y.test.js` | 11 + this doc | — |
| 2 | the flow spine and its sample clip | `src/lib/pilot-flow.js`, `pilot/sample-clip.json` | 364 | — |
| 3 | unit tests for the spine | `test/pilot-flow.test.js` (lines 1–183, 212–219) | 191 | 2 |
| 4 | the flow page — נהג / מנהל חניון / שלט כניסה | `demo/pilot.html` (minus the settings surface) | 333 | 2 |
| 5 | end-to-end: sample clip → driver alert | `test/pilot-e2e.test.js` (lines 1–212, 242–274) | 245 | 4 |
| 6 | the הגדרות surface: source picker, hold, EV-only | `demo/pilot.html` +94, `test/pilot-e2e.test.js` +29 | 123 | 4, 5 |
| 7 | offline shell, global nav and the pitch docs | `sw.js`, `src/lib/surface-nav.js`, `demo/atidim.html`, `demo/atidim-board.html`, `README.md`, `docs/pilot-atidim.md`, `docs/launch/CITYZONE-ATIDIM.md`, `test/pilot-flow.test.js` +28 | 128 | 1, 2, 4, 6 |

11 + 364 + 191 + 333 + 245 + 123 + 128 = **1395**, which is all of #273 (1393)
plus the two extra comment lines slice 1 gained when it was rewritten to match
the repo's existing floor idiom. Nothing is dropped and nothing is duplicated.

Slices 1 and 2 are independent of everything, including each other. The rest
are a chain and must land in the order of the table — this is a page built on a
library, so perfect independence is not available and pretending otherwise would
just produce red CI. Each slice is still *useful* on its own: 2 is a tested-next
library, 4 is a demoable page, 6 is a real new surface, 7 puts the whole thing
in the offline shell and in front of CityZone.

### Slice 1 — the sw cache assertion becomes a floor (this PR)

Shipped as code on this branch; `npm test` is green (471 passing).

`test/pricing-ui-a11y.test.js` pinned the service worker cache to **exactly**
`parkwiz-field-v18`. Slice 7 bumps it to v19, so that pin would turn a pricing
test red for a reason that has nothing to do with pricing. Every other cache
assertion in the suite is already a floor — `test/contact.test.js:55`,
`test/feedback-form.test.js:48`, `test/atidim-demo-page.test.js:130`,
`test/sw-precache.test.js:96` — so this is the odd one out, not a new idea.

It is worth landing even if the rest of #273 never does: it is the single file
standing between the shell and its next cache bump, whatever makes that bump.

### Slice 2 — the flow spine and its sample clip

`git show 3b72fa3:src/lib/pilot-flow.js` and
`git show 3b72fa3:pilot/sample-clip.json`, both unchanged.

Pure, DOM-free UMD like the rest of `src/lib`. It deliberately does **not**
recompute occupancy: `summarize()` delegates to `src/lib/atidim-lot.js`, which
stays the single source of truth for this lot. It ships without tests only
because its tests are 191 lines and 364 + 191 is over the limit — slice 3 has to
follow immediately, and reviewers should treat 2 and 3 as one review.

### Slice 3 — unit tests for the spine

`test/pilot-flow.test.js` with lines **184–211 removed**. That block is two
tests — `README and docs/pilot-atidim.md describe the one flow` and `the whole
flow is in the offline shell` — which assert on files that only exist after
slice 7. They move to slice 7 and are the reason this file cannot ship whole
here.

### Slice 4 — the flow page, three surfaces

`git show 3b72fa3:demo/pilot.html` with the settings surface lifted out:
CSS **70–76**, markup **146–166**, the `// ---- settings surface ----` block
**227–277**, the save/restore/source handlers **384–397**, and the lone
`fillSettingsForm();` boot call on **414** — miss that last line and the page
throws on load with everything else removed. 427 − 94 = 333.

Two small edits make the remainder stand on its own:

- line 200, `FLOW.SURFACES.map(...)` → `FLOW.SURFACES.filter(function (s) {
  return $(s.paneId); }).map(...)`, so the nav renders only surfaces whose pane
  is in the markup. `show()` already guards with `if (pane)`, so this is the
  only missing half. It is worth keeping after slice 6 lands.
- the banner's `ב<a href="#settings">הגדרות</a>` sentence (line 91) drops the
  link until slice 6 restores it.

The page is fully demoable here: it boots on the bundled sample clip (the
default source), plays it, and drives all three surfaces.

### Slice 5 — end-to-end, sample clip to driver alert

`test/pilot-e2e.test.js` with lines **213–241** removed — the one test that
drives the settings surface. It moves to slice 6 with the surface it tests.

The rest of the file needs no edit at all: its stub DOM is built from the ids it
scrapes out of the page (`markupIds` / `hiddenIds`, lines 28–42), so it adapts
to the slice-4 markup by construction. That is what makes cutting the page in
two safe.

### Slice 6 — the הגדרות surface

The 94 page lines slice 4 lifted out, plus e2e lines 213–241, plus restoring the
banner link. This is where the browser camera and the Frigate/NVR bridge become
selectable, and where hold length and EV-only filtering are set.

### Slice 7 — offline shell, global nav and the pitch docs

Everything that points *at* the flow, which is why it is last: each file here
links `demo/pilot.html`, and `test/pilot-flow.test.js` lines 184–211 (added
back here) assert those links exist. Carries the `sw.js` v18 → v19 bump, which
slice 1 already made safe.

## Handing the GitHub steps back

This worktree cannot push, open or close PRs (`gh` and network git are
unapprovable here), and the outer script opens exactly one draft PR — slice 1
plus this document. The remaining six are built from `3b72fa3` like this:

```sh
# slices 2 and 3, from the repo root, one branch each off master
git checkout -b split/273-2-pilot-flow-spine master
git checkout 3b72fa3 -- src/lib/pilot-flow.js pilot/sample-clip.json

git checkout -b split/273-3-pilot-flow-tests split/273-2-pilot-flow-spine
git checkout 3b72fa3 -- test/pilot-flow.test.js
# then delete lines 184-211 from test/pilot-flow.test.js

# slice 7, once 4-6 are in
git checkout 3b72fa3 -- sw.js src/lib/surface-nav.js demo/atidim.html \
  demo/atidim-board.html README.md docs/pilot-atidim.md \
  docs/launch/CITYZONE-ATIDIM.md
```

Slices 4–6 are the two intra-file cuts; take `demo/pilot.html` and
`test/pilot-e2e.test.js` from `3b72fa3` and apply the line ranges above.

Verify each branch with `git diff --shortstat master...HEAD` before opening —
additions + deletions is the number `auto_merger` reads — and run `npm test`.

## Close comment for #273

```md
Closing in favour of the split: `auto_merger` merges at most 400 changed
lines, and this PR is 1393. The plan, with measured sizes and the exact line
ranges for the two files that are over 400 on their own, is in
[`docs/dev/PR-273-SPLIT.md`](../../blob/master/docs/dev/PR-273-SPLIT.md).

| # | slice | lines | PR |
|---|---|---|---|
| 1 | sw cache assertion becomes a floor | 11 | #<!--1--> |
| 2 | the flow spine and its sample clip | 364 | #<!--2--> |
| 3 | unit tests for the spine | 191 | #<!--3--> |
| 4 | the flow page — נהג / מנהל חניון / שלט כניסה | 333 | #<!--4--> |
| 5 | end-to-end: sample clip → driver alert | 245 | #<!--5--> |
| 6 | the הגדרות surface | 123 | #<!--6--> |
| 7 | offline shell, global nav and the pitch docs | 128 | #<!--7--> |

Nothing is dropped: 11 + 364 + 191 + 333 + 245 + 123 + 128 = 1395, the 1393 of
this PR plus two comment lines slice 1 gained. Slices 1 and 2 are independent;
3–7 land in order, because a page built on a library cannot be split into
mutually independent halves.

**Do not delete `claude/ParkWiz-268-20261019-092939`.** Slices 4–6 are built
from `3b72fa3` and are unreachable without it.
```
