# Copilot instructions for ParkWiz

## Stack
Primary language: HTML. Top-level files: .github, .gitignore, LICENSE, MONETIZATION.md, NETANYA_OUTREACH.md, README.md, RESEARCH.md, availability-model.js, docs, icon.svg, index.html, manifest.json, marketplace.html, netanya-lots.geojson, offer.html, package.json, pilot-brief.html, pilot-calibrate.html, pilot-compare.html, pilot-dashboard.html, pilot-eval.html, pilot-kit.html, pilot-log.html, pilot-method.html, pilot-privacy.html. Dependencies: .

## Build / test / lint
- Install: `npm ci` (or `npm install`)
- `npm run test` -> node --test test/*.js
Always run the relevant checks above before opening a PR and report results in the PR body.

## Conventions
- Keep changes small and focused: one issue = one Draft PR.
- Branch prefix: `copilot/`. Never push to `master` and never merge.
- Follow existing code style and folder structure; don't add new dependencies without explaining why.
- Never commit secrets, tokens, or .env files.
- Write or update tests when changing logic; update README when behavior changes.