# ParkWiz — Market Research
_עודכן: 2026-08-11_

## המוצר
As checked in `README.md` and `index.html`, the repository currently shows two overlapping product stories. The README header and `PILOT_README.md` position ParkWiz as a municipal, privacy-first parking-occupancy pilot that turns existing city CCTV footage into street-level occupancy analytics without new hardware and without license-plate recognition. At the same time, `index.html` still ships a browser-only street-parking and private-parking demo with simulated live activity, premium copy, a private-space marketplace flow, and a static municipal parking-data layer. The most accurate description of the repo today is: ParkWiz is an early-stage project transitioning from a consumer parking demo toward a municipal CCTV occupancy pilot, and the municipal product is not yet reflected consistently across all shipped surfaces.

## גודל שוק
- Global smart parking systems market: **USD 10.2 billion in 2025**, projected to reach **USD 53.38 billion by 2033**, at a **23.3% CAGR** for 2026-2033.
  - Source: Grand View Research, January 2026, https://www.grandviewresearch.com/press-release/global-smart-parking-system-market

- **58%** of the world's population lives in urban areas in **2025**.
  - Source: United Nations Department of Economic and Social Affairs, *World Urbanization Prospects 2025*, 2025, https://population.un.org/wup/

- **75.2%** of Israel's population lives in municipalities with city status in **2024**.
  - Source: Israel Central Bureau of Statistics, 2024 local-authorities dashboard, https://data.cbs.gov.il/muni/home

- Tel Aviv-Yafo says the city is divided into **9 parking zones**; from **2025-02-02**, paid blue-and-white parking starts at **08:00** instead of **09:00**; resident permit holders get the first **2 cumulative hours per day** free outside their own zone via parking apps; the resident discount outside the home zone is **30%**; the resident discount in municipal parking lots remains **75%**.
  - Source: Tel Aviv-Yafo Municipality, 2024-11-26, https://www.tel-aviv.gov.il/en/Pages/MainItemPage.aspx?WebID=9336473c-1537-4ab6-8a69-d299b5db8bcc&ListID=b4eda22c-a69a-4bef-9479-05d5a832ad16&ItemID=308

- The Israeli Privacy Protection Authority said on **2026-04-26** that municipalities may not use **LPR** cameras for parking enforcement without explicit legal authorization.
  - Source: Privacy Protection Authority (Ministry of Justice, Israel), 2026-04-26, https://www.gov.il/he/pages/license_plate_cctv

- **לא נמצא נתון מאומת** על גודל שוק החניה החכמה בישראל בלבד מתוך מקור ציבורי קביל וזמין לציטוט חופשי.

## מתחרים
- **ParKam** — https://parkam.com/
  - What it does: camera-based smart parking and enforcement for cities and parking operators.
  - Difference from ParkWiz: closest conceptual match to the README/PILOT_README direction, but presented as a commercial platform rather than a repo that still contains a legacy consumer demo.

- **Parklio Detect** — https://parklio.com/en/parking-solutions/detect
  - What it does: parking-occupancy detection from existing cameras, with analytics and API-oriented product packaging.
  - Difference from ParkWiz: Parklio is a packaged parking-operations product; ParkWiz's current repo state is lighter, browser-first, and explicitly positioned around no new hardware and no license plates.

- **Camlytics** — https://camlytics.com/solutions/parking-analytics
  - What it does: video analytics for parking occupancy and vehicle counting on IP/CCTV cameras.
  - Difference from ParkWiz: Camlytics is a general video-analytics product; ParkWiz's municipal pitch is narrower and more tied to Israeli privacy positioning.

- **WiseSight** — https://www.wisesight.ai/
  - What it does: AI parking-compliance and curb-enforcement tooling for cities and operators.
  - Difference from ParkWiz: WiseSight leans into enforcement/compliance workflows, while ParkWiz's strongest repo-backed message is occupancy metadata without license-plate recognition.

- **Pumba** — https://www.pumba.tech/
  - What it does: smart parking visibility for cities using curbside sensing and AI.
  - Difference from ParkWiz: Pumba depends on field deployment, while ParkWiz's stated direction is to reuse existing municipal cameras.

- **Pango** — https://www.pango.co.il/
  - What it does: parking payment, permits, and mobility services.
  - Difference from ParkWiz: Pango is a payment/app layer, not a camera-based occupancy-detection layer.

## בידול
- The repo's strongest clear differentiation is **privacy-first occupancy detection without license-plate recognition**. That is stated in `README.md` and `PILOT_README.md`, and it aligns with the Israeli Privacy Protection Authority's 2026 restriction on municipal LPR parking enforcement.
- The stated deployment model is **reuse of existing municipal CCTV instead of new curb hardware**. That is a meaningful difference from sensor-heavy competitors such as Pumba.
- The checked-in municipal surface is **simple and lightweight**: `pilot-dashboard.html` reads occupancy JSON/JSONL and turns it into occupancy tiles, KPIs, a time-series chart, and a municipal summary, instead of requiring a full operator stack.
- The repo also shows a current limitation: the differentiation is strongest in product positioning and pilot UX, not in a fully shipped end-to-end production system.

## מה עוד לא מאומת
- Which product is the real primary product today: the municipal CCTV pilot in `README.md`/`PILOT_README.md`, or the older consumer parking demo still exposed by `index.html`.
- Whether the end-to-end camera pipeline named in `PILOT_README.md` (`frame-grabber.js`, `vision-bridge.js`, `occupancy.jsonl`) exists in this repository in runnable form; those files were not found in the checked-in tree reviewed for this task.
- Occupancy accuracy versus manual ground truth. No verified benchmark from a pilot, municipality, or test report was found.
- Whether any municipal customer, paid pilot, procurement path, or production deployment has been publicly validated.
- Whether all “real-time” or “live” claims in the consumer demo are backed by real data feeds; the repo audit says large parts of `index.html` are simulated.
- Whether the municipal data layers in the consumer demo are live or only static snapshots with incomplete provenance.
- Whether the no-license-plate promise is enforced across every code path; `index.html` still contains optional user-entered plate handling for consumer/demo flows.
