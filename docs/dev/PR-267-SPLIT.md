# PR for #267 — split plan into PRs of at most 400 changed lines

`auto_merger` merges PRs of at most **400 changed lines** (additions +
deletions). The #267 branch is **2153 added lines across 11 files**, because
the issue asks for five things at once: a two-language event contract, a
Smartcar adapter, an OCPP adapter, an Android Auto design doc, and a car-to-car
relay demo that has to satisfy the acceptance criterion on the live site.

This file is the seam, so the work can land as slices without re-deriving it.
Nothing below is dropped and nothing is duplicated.

## What the branch contains

| file | + | layer |
|---|---|---|
| `src/lib/car-api.js` | 528 | contract, privacy guard, auth shape, relay, ranker, Smartcar, OCPP |
| `demo/car-demo.html` | 504 | the simulator page named by the acceptance criterion |
| `test/car-api.test.js` | 344 | 19 tests over the library |
| `test/car-demo-acceptance.test.js` | 195 | boots the page's own script and measures delivery |
| `docs/car-api.md` | 170 | the wire contract, English |
| `docs/car-api-he.md` | 164 | the wire contract, Hebrew |
| `test/car-demo-page.test.js` | 155 | the page cannot lose a panel or an entry point |
| `docs/car-android-auto.md` | 80 | design + notification prototype plan |
| `sw.js` | 6 −3 | two shell entries + cache bump v18 → v19 |
| `test/pricing-ui-a11y.test.js` | 8 −3 | exact `v18` pin converted to a floor |
| `index.html` | 2 | homepage entry point to the demo |

The seams are **library vs page vs docs**, and inside the library the sections
are already marked with `// --- <name> ---` banners, so each slice is a cut at
a banner, not a rewrite.

## The slices

Line counts are measured from the section boundaries on this branch
(`src/lib/car-api.js` banners at 81/108/151/246/314/347/407, tests at the
`test(` lines), plus the per-file UMD wrapper each new library file needs.

| # | slice | paths | ~changed lines |
|---|---|---|---|
| 1 | event contract + privacy guard | `src/lib/car-api.js` (header, constants, privacy, contract, exports), `test/car-api.test.js` tests 1–6 | 346 |
| 2 | relay + auth shape | `src/lib/car-api.js` (+ auth, relay, `distanceM`), `test/car-api.test.js` tests 7–10, 14, 17 | 215 |
| 3 | spot ranker + Smartcar adapter | new `src/lib/car-ev.js`, `test/car-api.test.js` tests 11–13 | 240 |
| 4 | OCPP read-only adapter + simulator | `src/lib/car-ev.js` (+ OCPP section), tests 15–16 | 170 |
| 5 | contract doc, English | `docs/car-api.md`, the doc test | 200 |
| 6 | contract doc, Hebrew | `docs/car-api-he.md`, its half of the doc test | 180 |
| 7 | Android Auto design + prototype plan | `docs/car-android-auto.md`, its assertions | 92 |
| 8 | simulator page shell | `demo/car-demo.html` markup + extracted `pilot/car-demo.css`, `index.html`, `sw.js`, `test/pricing-ui-a11y.test.js`, structure tests | 290 |
| 9 | simulator page behaviour | the page's inline script, remaining `test/car-demo-page.test.js` | 390 |
| 10 | acceptance harness | `test/car-demo-acceptance.test.js` | 195 |

Order: 1 → 2 before anything else (every other slice imports the contract).
3 and 4 are independent of each other. 5, 6 and 7 are paper and can land at any
point. 8 → 9 → 10 must stay in order; slice 10 fails without slice 9.

### Two notes on the slicing

**Slice 3/4 need a second library file.** `src/lib/car-api.js` is 528 lines on
this branch, so it cannot be one slice. The cut is the `// --- which spot to
send the car ---` banner at line 314: everything below it (`rankSpots`,
`fromSmartcar`, `smartcarConfig`, the OCPP functions and the simulator) is an
*adapter* layer that imports the contract and is imported by the page, while
nothing above it depends on anything below. Moving it to `src/lib/car-ev.js`
makes slices 3 and 4 possible and costs the page one extra `<script src>` and
`sw.js` one extra precache entry.

**Slice 8 needs the page CSS extracted.** `demo/car-demo.html` is 504 lines, of
which lines 9–62 are the `<style>` block and 165–495 are the inline simulator
script. Pulling the style block into `pilot/car-demo.css` (the pattern
`pilot/shell.css` already follows for the `pilot-*.html` surfaces) splits the
page into a shell slice and a behaviour slice. Keep the no-CDN assertion in
`test/car-demo-page.test.js` pointed at both files after the move.

## If it lands whole instead

The acceptance criterion is one behaviour — a simulated EV receives a freed
spot within ~2 s — and slices 1, 2, 3, 8, 9 and 10 all have to be in before it
is demonstrable. Landing the branch whole is the only way the demo is green on
the live site in one step; the table above is for the case where the 400-line
rule wins instead.
