# ParkWiz agent playbook

GitHub is the source of truth. Each work package gets an issue, one owner, one branch, tests, and a short handoff. No two agents edit `index.html` concurrently.

## Roles

- Codex: orchestrator, integration, tests, and release.
- Claude Code: bounded implementation packages after reading `HANDOFF.md`.
- Gemini: Hebrew UX, RTL, accessibility, and visual review.
- Perplexity: source discovery; every claim must retain its URL, date, license, and confidence.
- Grok: adversarial review and edge-case discovery.
- GitHub Copilot: mechanical refactors and test expansion.

Never claim an integration or review ran unless its output was captured. Never expose credentials in prompts, commits, logs, or handoffs.

## Product contract

The core answer is: “Is parking likely to be legal and worthwhile here at arrival time for this vehicle or permit?” Availability is always an estimate with source, timestamp, confidence, and factors. Municipal parking-zone data is not automatically curb legality, and facility status is not street-space occupancy.
