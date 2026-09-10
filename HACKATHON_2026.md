# ParkWiz — AI x City Climate Action Hackathon 2026

## Status

Submission draft only. Registration and submission have not been performed. No city partner, live camera feed, measured emissions reduction, or production AI service is claimed.

## Fit to the challenge

- **Priority area:** urban transportation.
- **Climate problem:** drivers searching for parking add avoidable vehicle time, fuel use, local air pollution, and congestion.
- **Proposed intervention:** privacy-preserving parking occupancy estimates plus route guidance, evaluated against a no-guidance control.
- **City scale:** start with one instrumented corridor and publish a repeatable evaluation protocol before expansion.
- **AI role:** classify spaces as occupied/free from licensed, non-LPR imagery. The current repository demonstrates the product and evaluation surfaces; it does not yet include or claim a trained production model.

## Honest 200-character draft

> ParkWiz tests privacy-preserving parking occupancy guidance to reduce search traffic. A controlled city pilot measures time saved and CO₂e scenarios without license-plate recognition.

## Evidence and hypotheses

| Claim | Current status | Evidence needed |
|---|---|---|
| Parking guidance reduces search time | Hypothesis | Controlled baseline/assisted trips in one corridor |
| Reduced search time reduces fuel and CO₂e | Scenario model | Local fleet assumptions and measured time difference |
| Camera occupancy can work without LPR | Technical hypothesis | Licensed sample, labelled ground truth, precision/recall |
| A city will adopt the workflow | Unverified | Named city owner and written pilot permission |

The interactive scenario model is in [`climate-impact.html`](./climate-impact.html). It exposes every assumption and reports zero savings when the assisted route is not faster.

## Minimum pilot dataset

1. A city-approved or openly licensed camera view that cannot read license plates.
2. At least 100 manually labelled observations across day/night/weather conditions.
3. Baseline and assisted search-time samples with timestamps and route boundaries.
4. Model precision, recall, false-free rate, latency, and coverage.
5. A documented retention policy; no faces, plates, or raw imagery retained by default.

## Go/no-go gates before submission

- [ ] Every team member completes the registration form.
- [ ] A named 18+ participant owns the submission.
- [ ] The demo link works on mobile and clearly labels synthetic data.
- [ ] The AI method is demonstrated at least partially on licensed data.
- [ ] Climate impact is presented as measured evidence or explicitly as a scenario.
- [ ] Privacy and failure modes are included in the pitch.
- [ ] The final form is reviewed by a human before submission.

## Official event facts

- Challenge: AI-driven solutions that accelerate city climate action; transportation receives additional points.
- Submission deadline: 31 August 2026 at 23:59 GMT (the event page also displays 23:55 CET; confirm the form deadline before submission).
- Finalists pitch in September at a hybrid University of Cambridge event.
- Selected winners may receive support for the Urban Transitions Mission summit in Viladecans, Spain, and a potential city pilot.

Sources:

- https://www.innovate4cities.org/hackathon/hackathon2026/
- https://www.innovate4cities.org/blog/the-2026-ai-x-city-climate-action-hackathon-is-officially-live/

## Next external validation action

Ask a Netanya mobility or innovation contact for permission to evaluate one corridor using non-identifying imagery. Do not claim partnership until written confirmation exists.
