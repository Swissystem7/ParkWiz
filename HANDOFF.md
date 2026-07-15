# ParkWiz Agent Handoff

STATUS: NEEDS_USER
LAST_UPDATE: 2026-07-15
GITHUB_ISSUE: https://github.com/Swissystem7/ParkWiz/issues/1

## Verified context

- ParkWiz is currently a single-file HTML demo.
- Random timers that fabricated live availability and Pango checkout events were disabled.
- The UI now identifies municipal GIS separately from statistical estimates.
- Claims about live Pango/Cello data and measured vehicle-fit were removed or marked unavailable.
- No external live-occupancy API has been verified. Do not invent one.

## Current task

Review the existing changes, then implement a transparent deterministic availability model:

1. Compute availability from explicit inputs only: hour, day of week, and area/street baseline.
2. Use a documented formula with named constants and no `Math.random()` in scoring.
3. Return both `score` and `confidence`; explain the contributing factors in the UI.
4. Add `confidence`, `createdAt`, and `expiresAt` to genuine user-created local reports only.
5. Give parking-availability reports a short TTL (3–7 minutes); expired reports must not affect scoring.
6. Keep municipal GIS, model output, demo fixtures, and user reports visibly distinct.
7. Do not claim real-time occupancy, Pango/Cello integration, or measured spot dimensions.

## Required evidence

- Demonstrate identical inputs returning identical outputs.
- Compare at least these scenarios for the same area: weekday evening, Friday morning, and late night.
- Verify that an expired report has zero influence.
- Verify that confidence rises only when a valid, non-expired report is present.
- Record commands/results in `TEST_EVIDENCE.md`.

## Review protocol

- The implementing agent completes the full task.
- The second agent audits correctness, product honesty, and regression risk.
- Do not push, deploy, connect accounts, or grant OAuth scopes without Avira's explicit approval.

## Blocker

Claude Code is not authenticated on this machine. Avira must run `/login` in Claude Code.

## Next action

After login, Codex verifies authentication and transitions `PW-001` to `READY`; Claude Code may then claim it.
