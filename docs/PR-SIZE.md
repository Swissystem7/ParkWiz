# PR size budget — 400 changed lines

`auto_merger` merges a pull request only when it changes **at most 400 lines**
(additions + deletions, as GitHub counts them). Anything bigger stays open until
somebody splits it by hand. PR #126 reached 978 lines and stalled; this page is
how we avoid the next one.

## Check before you open the PR

```sh
npm run pr-size                       # HEAD vs origin/master
node scripts/pr-size.js --base master --check   # exit 1 when over budget
git diff --numstat master...HEAD | node scripts/pr-size.js --stdin
```

Over budget, the command prints a split plan — the changed files grouped into
parts that each fit. The `size` job in `.github/workflows/validate.yml` runs the
same check on every pull request, so the number shows up before review rather
than at merge time.

## How the plan groups files

A part is only worth reviewing if it stands on its own, so files are first
grouped into **units** that are never split across parts:

| Unit | Files |
|---|---|
| `lib:<name>` | `src/lib/<name>.js` plus every `test/<name>*.test.js` in the same diff |
| `page:<name>` | `<name>.html` |
| `pwa` | `sw.js`, `manifest.json`, `icon.svg` |
| `docs:<dir>` | `docs/<dir>/**`, and each root `*.md` on its own |
| `ci:<dir>` | `.github/<dir>/**` |

Units are then packed into parts first-fit-decreasing. A test only joins a
module when that module is also changing — otherwise the test is its own unit,
because a test-only PR is a legitimate standalone change.

A unit that is over budget on its own cannot be grouped any further; the plan
lists it under *"Needs a manual, commit-by-commit split"*. Split those with
`git cherry-pick` onto fresh branches off `master`, smallest useful change
first.

## Splitting an oversized PR

1. Run the tool against the oversized branch:
   `node scripts/pr-size.js --base master --head <branch>`.
2. For each proposed part, branch off `master` and bring over only that part's
   files — `git checkout <branch> -- <files>` keeps the content identical to the
   reviewed work.
3. Run `npm test` on every part. Each part must pass on its own; if a part fails
   without another part, the grouping was wrong — move the files together.
4. Open the parts as separate PRs, then close the oversized one with a comment
   listing them.

## Overriding the gate

Some changes genuinely cannot be split — a generated data file, a single
large document. Add the `oversize-ok` label to the PR and the `size` job is
skipped. `auto_merger` still will not merge it, so an oversized PR needs a
human merge.
