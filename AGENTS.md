# Notes for coding agents

## Commands

Install, lint, build, and test commands below are taken from `package.json` and the lockfile. If a step is listed as **none defined**, skip it and do not invent a command.

| Step | Command | Notes |
|---|---|---|
| Install | `npm ci` | `package-lock.json` is present (lockfileVersion 3). There are no production `dependencies`; devDependencies include knip, size-limit, Playwright, and Leaflet. |
| Lint | none defined | There is no lint/script such as `check:style`, and no `biome.json` or `@biomejs/biome` in this repository. Related existing checks (not a lint runner): `npm run check:html`, `npm run check:a11y-static`, `npm run doctor`, `npm run knip`, `npm run size`, `npm run check:data`. |
| Build | none defined | There is no `build` script. The app is vanilla HTML/JS; `npm start` runs `node server/node.js` for a local API + site on http://127.0.0.1:8787. |
| Test | `npm test` | Runs `node --test test/*.js`. Other existing scripts: `npm run coverage`, `npm run test:assign`, `npm run test:smoke`, `npm run test:load`. |

Before opening a PR, run every lint, build, and test command that exists in the table above.

## Folder structure

- `index.html`, `live-assign.html`, `marketplace.html`, `offer.html`, `pilot*.html`, `sw.js`, `manifest.json`, `vercel.json` — pages and site entry points at the repo root.
- `src/lib/` — core libraries (most of the application logic).
- `src/ui/` — UI helpers.
- `src/agents/` — in-repo agent-related modules.
- `test/` — Node test suite (`test/*.js`), plus `test/smoke/`, `test/helpers/`, `test/fixtures/`, `test/e2e/`.
- `server/` — local Node server (`npm start`).
- `scripts/`, `tools/`, `schemas/`, `api/`, `demo/`, `pilot/`, `docs/`, `design/`.
- `CONTRIBUTING.md`, `README.md`, this file.

## Style

No Biome (or other) formatter/linter config is in the repository. Match the surrounding file: existing vanilla HTML and client-side JavaScript style, and do not add a formatter or lint stack that is not already here.

## Rules

- **UI design** comes only from Claude Design and is implemented as-is, without changes.
- **Before opening a PR**, run lint, build, and test locally (skip any step listed as none defined; do not invent commands).
- **Never** touch `.github/workflows` or any merge mechanism, auto-merge, or merge scripts. **Never** push to `master` or `main`. Do not merge pull requests and do not enable auto-merge.

## Existing notes

- There are no runtime dependencies — vanilla HTML/JS in the browser, deployed via GitHub Pages.
- Default-branch CI currently runs `node --test` with coverage, a security scan, and a Codecov upload. That is documentation only: do not edit workflow files.
