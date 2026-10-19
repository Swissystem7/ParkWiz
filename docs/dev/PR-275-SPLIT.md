# PR #275 — split into PRs of at most 400 changed lines (Refs #277)

`auto_merger` merges PRs of at most **400 changed lines** (additions +
deletions). [PR #275](https://github.com/Swissystem7/ParkWiz/pull/275) is
**2254** — five and a half times over, and the largest one yet.

PR #275 head: `3cf5f96` (branch `origin/claude/ParkWiz-267-20261019-094832`),
one commit cut against `master` at `159babb`. Every `git show` below assumes
that sha stays reachable, which it does as long as the branch is not deleted.

Master has since moved to `8211557` (#276, the #273 split plan). That is good
news here, not a conflict: #276 is what converted the last exact `sw.js` cache
pin in `test/pricing-ui-a11y.test.js` into a floor, so the `v18 → v19` bump
#275 needs is already safe and that part of #275 drops entirely.

## What PR #275 contains

One feature, from issue #267: a car ↔ app event contract (`spot-freed` /
`spot-claim` / `spot-release`), a geofenced relay, a Smartcar normalizer in
simulated mode, a read-only OCPP adapter, an Android Auto plan, and the Hebrew
browser simulator that has to deliver a freed spot to a simulated EV in ~2 s.

| file | +/− | layer |
|---|---|---|
| `src/lib/car-api.js` | +533 | contract, privacy guard, auth shape, relay, ranker, Smartcar, OCPP |
| `demo/car-demo.html` | +504 | the simulator page the acceptance criterion names |
| `test/car-api.test.js` | +358 | 20 tests over the library and the docs |
| `test/car-demo-acceptance.test.js` | +195 | boots the page's own script, measures delivery |
| `docs/car-api.md` | +170 | the wire contract, English |
| `docs/car-api-he.md` | +164 | the wire contract, Hebrew |
| `test/car-demo-page.test.js` | +155 | the page cannot lose a panel or an entry point |
| `docs/car-android-auto.md` | +80 | Android Auto design + notification prototype plan |
| `docs/dev/PR-267-SPLIT.md` | +79 | **drops** — an estimate-based plan, superseded by this file |
| `sw.js` | +5 −1 | precache the page and the lib; cache v18 → v19 |
| `index.html` | +2 | homepage entry point to the demo |
| `test/pricing-ui-a11y.test.js` | +6 −2 | **drops** — master already has this floor, via #276 |

87 of the 2254 lines are those two dropped files, leaving **2167** lines of
feature. Two of them are over 400 **on their own**, so the usual code-vs-docs
seam is not enough: the library and the page each have to be cut internally.

## The slices

Sizes are measured, not estimated. Per-file numbers come from
`git diff --numstat master...3cf5f96`; every line range below was materialised
with `sed -n` and counted with `wc -l`.

| # | slice | changed lines | needs |
|---|---|---|---|
| 1 | the event contract and the privacy guard | 325 | — |
| 2 | the token shape and the geofenced relay | 212 | 1 |
| 3 | the adapters: ranker, Smartcar, read-only OCPP | 308 | 1 |
| 4 | the wire contract, both languages | 362 | 1 |
| 5 | the Android Auto plan (**this PR**) | 140 | — |
| 6 | the simulator page shell, homepage entry, offline shell | 273 | 1, 4, 5 |
| 7 | the simulator page behaviour | 381 | 2, 3, 6 |
| 8 | the acceptance harness | 218 | 7 |

325 + 212 + 308 + 362 + 140 + 273 + 381 + 218 = **2219**, which is the 2167
lines of feature, minus the 8 Android-Auto assertions lifted out of the shared
doc test, plus the 60 lines of standalone test and doc intro that replace them
(see slice 5). Nothing is dropped except the two files named above.

Slices 1 and 5 are independent of everything, including each other. The rest
form the dependency column: a page built on a library cannot be split into
mutually independent halves, and pretending otherwise just produces red CI.
Each slice is still *useful* on its own — 1 is a tested contract, 3 makes the
vendor adapters usable, 4 is the document a third-party integrator reads, 6 is
a page in the offline shell, 7 makes it work, 8 proves the ~2 s claim.

Landing order: **5 → 1 → 2 → 3 → 4 → 6 → 7 → 8**.

### Slice 1 — the event contract and the privacy guard (325)

`src/lib/car-api.js` lines **1–107** and **151–245** (202), plus a `return {}`
block carrying only the 14 names defined so far (17). `test/car-api.test.js`
lines **1–106** (106) — the header, the fixtures and the first six tests.

The constant table at lines 35–48 (`DEFAULT_RADIUS_M`, `LOW_BATTERY_PCT`,
`AUTH_PREFIX`, `SCOPES` …) rides along unused here. Splitting a constant block
across three PRs is churn for its own sake; it reads as one block.

### Slice 2 — the token shape and the geofenced relay (212)

`src/lib/car-api.js` lines **108–150** and **246–318** (116) plus 6 export
lines. `test/car-api.test.js` lines **107–174** and **244–263** (88) plus two
blank separators.

Auth ships with the relay because that is the only thing that checks it:
`checkAuth` deliberately does not implement HMAC-SHA256, so `CAR_RELAY_SECRET`
never has to exist in a browser.

### Slice 3 — the adapters (308)

`src/lib/car-api.js` lines **319–499** (181) plus 11 export lines —
`rankSpots`, the Smartcar normalizer and config reader, and the read-only OCPP
adapter with its simulator. `test/car-api.test.js` lines **176–242** and
**265–311** (114) plus two blank separators.

Independent of slice 2: nothing above line 319 depends on anything below it,
and nothing in this block touches the relay. `smartcarConfig` is the part worth
reviewing twice — it returns whether a secret is present, never the secret, and
will not enter live mode without `SMARTCAR_ALLOW_LIVE=1`.

### Slice 4 — the wire contract, both languages (362)

`docs/car-api.md` (170) and `docs/car-api-he.md` (164) together, plus
`test/car-api.test.js` lines **313–338** re-closed with `});` (28).

The two docs cannot be split from each other: the test's whole point is that
they say the same thing — same three events, same `Authorization: Bearer pw1`,
same env var names, same list of identity keys the guard drops. Ship one
language alone and the test that keeps them honest has nothing to compare.
The Hebrew doc stays Hebrew; the test asserts that too.

Lines **339–347** of that test (the Android Auto assertions) are not here —
they move to slice 5.

### Slice 5 — the Android Auto plan (this PR, 140)

Shipped as code on this branch; `npm test` is green (475 passing, up from 471).

`docs/car-android-auto.md` (81) and `test/car-android-auto-doc.test.js` (59).

On the #275 branch this doc is tested by 8 assertions inside
`test/car-api.test.js`'s doc test, which would have chained it behind slice 1.
It is the one part of #267 with no code dependency at all, so it is the only
slice that can land in the same PR as this plan without breaking the 400-line
budget — and that is worth a real test file rather than a tail on someone
else's test. The four tests pin what a plan loses when nobody is looking: that
it stays design-only (including that no `app/` directory appears), that it
names the actual `androidx.car.app` templates, that the in-car surface inherits
the opt-in and no-plates rules, and that the driver-facing strings stay Hebrew.

One line of the doc changed: its opening cross-references to `docs/car-api.md`,
`docs/car-api-he.md` and `demo/car-demo.html` are now plain paths with a note
that they land with the rest of #267, instead of markdown links that would be
dead until slices 4 and 6.

### Slice 6 — the page shell, the homepage entry, the offline shell (273)

`demo/car-demo.html` lines **1–164** and **496–504** (173) — head, `<style>`,
all five Hebrew panels, the footer, the `<script src="../src/lib/car-api.js">`
tag and the service-worker registration, but **not** the inline simulator
script. The seam is the `<script>` tag at line 165, so there is no dangling
reference to chase: the markup is simply inert until slice 7.

Plus `index.html` (+2), `sw.js` (+5 −1, including the v18 → v19 bump #276 made
safe), `test/car-demo-page.test.js` lines **1–51**, **110–125** (minus the one
`aria-pressed` assertion, which matches the inline script) and **140–155**
(82), and `test/car-api.test.js` lines **349–358** — the no-committed-secrets
test, which reads the page and so cannot land before it (10).

Lands after 4 and 5 because the page header and footer link to all three docs.

### Slice 7 — the page behaviour (381)

`demo/car-demo.html` lines **165–495** (331): the inline simulator — the
leaving-car publisher, the EV subscriber, the OCPP panel driver, the event log,
the plate probe and the reset. Plus `test/car-demo-page.test.js` lines
**52–65**, **66–75**, **99–109** and **126–139**, and the `aria-pressed`
assertion slice 6 left out (50).

The biggest slice, with 19 lines of headroom. If it has to shrink, the OCPP
panel is the clean cut — markup **119–133**, script **190–193**, **209**,
**332–352** and **353–376**, the two boot calls at **490–491** and the two
reset calls at **480–481** — but `btnCopyLog` writes its feedback into
`#ocppStatus`, so that cut also needs a status line in the log panel. Not worth
it unless the measurement comes out wrong.

### Slice 8 — the acceptance harness (218)

`test/car-demo-acceptance.test.js` (195) — it boots the page's real inline
script against a fake DOM, clicks the real buttons and measures real elapsed
time, so it is the only thing that actually proves the #267 criterion. Plus
`test/car-demo-page.test.js` lines **76–98** (23), the test that re-derives the
charger preference from the page's own coordinates and battery default through
`carApi.rankSpots`. That test is a library-and-page-agree check, which belongs
with the harness that asks the same question about latency.

## Handing the GitHub steps back

This worktree cannot push, open or close PRs (`gh` and network git are
unapprovable here), and the outer script opens exactly one draft PR — slice 5
plus this document. The other seven are built from `3cf5f96`:

```sh
# from the repo root, one branch off master each
git checkout -b split/275-1-car-contract master
git checkout 3cf5f96 -- src/lib/car-api.js test/car-api.test.js
# then keep only the line ranges above and close the export block

git checkout -b split/275-4-car-api-docs master
git checkout 3cf5f96 -- docs/car-api.md docs/car-api-he.md

git checkout -b split/275-8-car-acceptance split/275-7-car-page-behaviour
git checkout 3cf5f96 -- test/car-demo-acceptance.test.js
```

Verify each branch with `git diff --shortstat master...HEAD` before opening —
additions + deletions is the number `auto_merger` reads — and run `npm test`.

## Close comment for #275

```md
Closing in favour of the split: `auto_merger` merges at most 400 changed lines,
and this PR is 2254. The plan, with measured sizes and the exact line ranges
for the library and the page (both over 400 on their own), is in
[`docs/dev/PR-275-SPLIT.md`](../../blob/master/docs/dev/PR-275-SPLIT.md).

| # | slice | lines | PR |
|---|---|---|---|
| 1 | the event contract and the privacy guard | 325 | #<!--1--> |
| 2 | the token shape and the geofenced relay | 212 | #<!--2--> |
| 3 | the adapters: ranker, Smartcar, read-only OCPP | 308 | #<!--3--> |
| 4 | the wire contract, both languages | 362 | #<!--4--> |
| 5 | the Android Auto plan | 140 | #<!--5--> |
| 6 | the page shell, homepage entry, offline shell | 273 | #<!--6--> |
| 7 | the page behaviour | 381 | #<!--7--> |
| 8 | the acceptance harness | 218 | #<!--8--> |

Two files drop rather than move: `docs/dev/PR-267-SPLIT.md` (an estimate-based
plan, superseded) and `test/pricing-ui-a11y.test.js` (master already has that
cache floor, via #276). That accounts for 87 of the 2254 lines; the slices sum
to 2219, which is the remaining 2167 plus the standalone Android Auto doc test
that replaces 8 assertions on a shared one. Nothing else is dropped.

Landing order is **5 → 1 → 2 → 3 → 4 → 6 → 7 → 8**; 1 and 5 are independent of
everything.

**Do not delete `claude/ParkWiz-267-20261019-094832`.** Every slice is built
from `3cf5f96` and is unreachable without it.
```
