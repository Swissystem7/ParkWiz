# PR #282 part 1 — spot-freed core (Refs #367)

Issue #367 asks for three draft PRs off `master`, each under 400 changed
lines, from [PR #282](https://github.com/Swissystem7/ParkWiz/pull/282)
(`claude/ParkWiz-265-20261019-123435`, head `1f22479`). This PR is part 1
only: the spot-freed core. #282 and #367 stay open.

## Part 1 on the #282 file list

GitHub's three-dot numbers for #282 (merge-base `abc47ef`) are 1052
additions and 2 deletions, 1054 changed lines. Part 1 is the module plus
about 110 lines of its test file (~394):

| file | additions | deletions | in part 1 |
|---|---:|---:|---|
| `src/lib/spot-freed.js` | 284 | 0 | whole file |
| `test/spot-freed.test.js` | 195 | 0 | ~110 lines; the other ~85 are part 3 |

284 + 110 = 394, under the 400-line cap. The full test file together with the
module is 479, which is over the cap, so #367 splits the test file.

## Already on `master`

Both files match `master` (`7ffc5f1`) byte for byte, and they match the #282
branch:

| file | blob |
|---|---|
| `src/lib/spot-freed.js` | `5ff792d0267d181a56ae175d131960aaa3ff5180` |
| `test/spot-freed.test.js` | `a5fab1a2d3c6ea54bf43d73e748912d64976bdac` |

Slice 1 landed in #302 (`src/lib/spot-freed.js` +226, `test/spot-freed.test.js`
+164). #303 brought the module to 284 lines (+62 −4) and the test file to 195
(+31). Applying part 1 again on current `master` changes 0 lines.

The full 195-line test file stays. It holds 18 tests: baseline, confirm
window, uncertain frames, eligibility, relay payload, grid labels, Hebrew
alert text, freshness, navigation links, and skipped ids. Replacing it with a
~110-line prefix would remove cases that already pass.

## Tests

On `7ffc5f1`, before this note:

- `npm test`: 656 pass, 0 fail.
- `node --test test/spot-freed.test.js test/spot-freed-board-ui.test.js`: 27 pass, 0 fail (18 + 9).

## Remaining parts

Issue counts are GitHub's three-dot additions + deletions. Against current
`master` those paths are already present. #282's copies of `sw.js`,
`README.md`, and the two docs are the older text.

| part | files (issue count) | issue lines | vs `master` |
|---|---|---:|---|
| 2 board UI | `demo/atidim-board.html` (109), `test/spot-freed-board-ui.test.js` (214), `sw.js` (5), `README.md` (1) | ~329 | Board page blob `2131a3cdbc5b23dfa251b351efabc571c57d0ce2` and board test blob `0062ea8491c18ae49023d2aa29a7b1a5130d0d24` match the #282 branch. The README sentence for the feed and the `./src/lib/spot-freed.js` precache entry are on `master` (cache `parkwiz-field-v26`). |
| 3 tests and docs | rest of `test/spot-freed.test.js` (~85), `docs/dev/PR-265-SPLIT.md` (145), `docs/atidim-research.md` (101) | ~331 | The whole test file is on `master`. Master's split note and research status table are the later revisions (#303, #322). |

This branch is new from `master`. The #282 branch was left as it is.
