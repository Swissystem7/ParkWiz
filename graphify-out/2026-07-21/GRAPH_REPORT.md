# Graph Report - .  (2026-07-21)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 142 nodes · 154 edges · 23 communities (20 shown, 3 thin omitted)
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.58)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d73b2a05`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- index.html (Main App)
- manifest.json
- haversineMeters.test.js
- aggregateAnonymizedData.test.js
- estimateSearchTrafficReduction.test.js
- Pilot README
- test.js
- bookingPayload.js
- apiClient.test.js
- logEnforcementAction.test.js
- spotPayload.test.js
- normalizePlate.test.js
- weightedAvailability.test.js
- factory-ci workflow
- formatDuration.test.js
- _pw_patch.js
- README

## God Nodes (most connected - your core abstractions)
1. `index.html (Main App)` - 14 edges
2. `Spec v2 Municipal Integration` - 10 edges
3. `Pilot README` - 7 edges
4. `ParkWiz System` - 6 edges
5. `buildBookingPayload()` - 5 edges
6. `Aviram Swisa` - 4 edges
7. `ValidationError()` - 3 edges
8. `createClient()` - 3 edges
9. `haversineMeters()` - 3 edges
10. `buildSpotPayload()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Netanya Outreach Draft` --references--> `ParkWiz System`  [INFERRED]
  NETANYA_OUTREACH.md → PILOT_README.md
- `Spec v2 Municipal Integration` --references--> `ParkWiz System`  [INFERRED]
  SPEC-v2-municipal-integration.md → PILOT_README.md
- `Aviram Swisa` --references--> `index.html (Main App)`  [INFERRED]
  NETANYA_OUTREACH.md → index.html
- `validate workflow` --references--> `index.html (Main App)`  [INFERRED]
  .github/workflows/validate.yml → index.html
- `Aviram Swisa` --references--> `Pilot README`  [INFERRED]
  NETANYA_OUTREACH.md → PILOT_README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Pilot Pipeline** — frame_grabber, vision_bridge, gemini_flash_vision, occupancy_jsonl, pilot_dashboard_html [EXTRACTED 0.90]
- **Truth Matrix and Audit** — factory_feature_truth_matrix_md, factory_evidence_current_state_audit_md [EXTRACTED 0.90]

## Communities (23 total, 3 thin omitted)

### Community 0 - "index.html (Main App)"
Cohesion: 0.19
Nodes (16): Availability Prediction, Current State Audit, Feature Truth Matrix, Gamification, sentinel workflow, validate workflow, Google Maps Integration, index.html (Main App) (+8 more)

### Community 1 - "manifest.json"
Cohesion: 0.15
Nodes (12): background_color, description, dir, display, icons, lang, name, orientation (+4 more)

### Community 2 - "haversineMeters.test.js"
Cohesion: 0.22
Nodes (9): haversineMeters(), anti, assert, cross, { haversineMeters }, oneDegLat, oneDegLng, tlvJlm (+1 more)

### Community 3 - "aggregateAnonymizedData.test.js"
Cohesion: 0.22
Nodes (8): aggregateAnonymizedData(), { aggregateAnonymizedData }, assert, bin8, merged, out, recs, twoLoc

### Community 4 - "estimateSearchTrafficReduction.test.js"
Cohesion: 0.22
Nodes (8): estimateSearchTrafficReduction(), assert, { estimateSearchTrafficReduction }, r1, r2, r3, r4, rows

### Community 5 - "Pilot README"
Cohesion: 0.33
Nodes (8): Aviram Swisa, frame-grabber.js, Gemini Flash Vision, Netanya Outreach Draft, occupancy.jsonl, ParkWiz System, Pilot README, vision-bridge.js

### Community 6 - "test.js"
Cohesion: 0.32
Nodes (5): normalizePlate(), assert, { normalizePlate }, { weightedAvailability }, weightedAvailability()

### Community 7 - "bookingPayload.js"
Cohesion: 0.39
Nodes (6): buildBookingPayload(), num(), round2(), assert, { buildBookingPayload }, toDate()

### Community 8 - "apiClient.test.js"
Cohesion: 0.43
Nodes (4): createClient(), assert, { createClient, ValidationError }, ValidationError()

### Community 9 - "logEnforcementAction.test.js"
Cohesion: 0.33
Nodes (5): logEnforcementAction(), assert, { logEnforcementAction }, result, resultNoMeta

### Community 10 - "spotPayload.test.js"
Cohesion: 0.38
Nodes (5): buildSpotPayload(), num(), assert, { buildSpotPayload }, withOpts

### Community 11 - "normalizePlate.test.js"
Cohesion: 0.40
Nodes (4): normalizePlate(), assert, INVALID, { normalizePlate }

### Community 12 - "weightedAvailability.test.js"
Cohesion: 0.40
Nodes (4): assert, mixed, { weightedAvailability }, weightedAvailability()

### Community 13 - "factory-ci workflow"
Cohesion: 0.60
Nodes (5): factory-ci workflow, lib README, normalizePlate.js, spotPayload.js, weightedAvailability.js

## Knowledge Gaps
- **64 isolated node(s):** `fs`, `s`, `assert`, `{ normalizePlate }`, `{ weightedAvailability }` (+59 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `index.html (Main App)` connect `index.html (Main App)` to `Pilot README`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `ParkWiz System` connect `Pilot README` to `index.html (Main App)`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `index.html (Main App)` (e.g. with `Aviram Swisa` and `validate workflow`) actually correct?**
  _`index.html (Main App)` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `Pilot README` (e.g. with `Aviram Swisa` and `ParkWiz System`) actually correct?**
  _`Pilot README` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `ParkWiz System` (e.g. with `Aviram Swisa` and `Netanya Outreach Draft`) actually correct?**
  _`ParkWiz System` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `fs`, `s`, `assert` to the rest of the system?**
  _64 weakly-connected nodes found - possible documentation gaps or missing edges._