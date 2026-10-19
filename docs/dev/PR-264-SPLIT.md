# #264 — real camera occupancy in the browser: PR split

Issue #264 is one feature but ~700 lines of code: a detection engine, a camera
page, and the offline/demo packaging. `auto_merger` rejects a PR over ~400
lines, so it ships in three slices, engine first — the other two depend on it.

## Slice 1 — the engine (this PR, ~350 lines)

`src/lib/vision-occupancy.js` + `test/vision-occupancy.test.js`. No DOM, no
model, no pixels: vehicle boxes in, per-spot occupied/free state out.

- `normalizeDetections(preds, {frameWidth, frameHeight, minScore, classes})` —
  COCO-SSD pixel `bbox` predictions to normalized boxes; drops non-vehicles,
  low scores, and whole-frame artefacts (`MAX_BOX_AREA`).
- `boxSpotScore(box, spot)` — spot coverage, with a centroid shortcut gated on
  `CENTROID_MIN_INSIDE` so an aisle-driving car cannot claim a bay it grazes.
- `createTracker(spots, {threshold, debounceFrames})` → `update(boxes, ts)`
  returning `{ts, total, occupied, free, rate, spots, freed, taken}`. `freed`
  is the debounced occupied→free transition, reported exactly once.
- `spotFromDrag(a, b, id)` — drag corners to a `pilot/sample-spots.json` rect.
- `toRecord(state, opts)` — a reading as one `src/lib/occupancy.js` record, so
  the chart and the CSV/JSON export reuse the existing schema.

## Slice 2 — `demo/camera.html` (~330 lines)

The live page: browser-side wiring only, every occupancy decision in slice 1.

- Chrome: `lang="he" dir="rtl"` + `pilot/shell.css` (`.banner`, `.panel`,
  `.toolbar`, `button.primary`, `svg.chart`, `.skip-link`); local CSS only for
  `#frame`, the KPI row and `#toast`.
- Sources, all drawn into `#frame` from one hidden `<video>` / `<img>`: a file
  input (`accept="video/*,image/*"` via `URL.createObjectURL`),
  `getUserMedia({video:{facingMode:'environment'}})`, and a URL field
  (`video.src`, CORS-permitting; MJPEG/HLS best-effort).
- Detector: `tfjs@4.22.0` + `coco-ssd@2.2.3` from jsdelivr, injected on first
  use (not on page load) with a Hebrew failure message; `lite_mobilenet_v2`
  base; `model.detect(canvas)` on a ~700ms interval (~1.4 fps).
- Spots: pointerdown/move/up drag → `spotFromDrag`, plus undo and clear.
  Overlay: cyan detection boxes, green/red spot fills with ids.
- KPIs `#kpiFree` / `#kpiRate` / `#kpiCars`, plus `OCC.chartSvg(records)` and
  a per-hour line from `OCC.byHour(records)` — real detections, never seeded.
- On `state.freed`: `window.dispatchEvent(new CustomEvent('parkwiz:spot-freed',
  {detail:{spotId, source:'camera', ts}}))` + the toast, per #263.
- `test/camera-page-ui.test.js`: inline scripts parse under `vm`; every
  `VO.*` / `OCC.*` call exists in the required module; Hebrew RTL + skip link;
  the privacy claim is on the page; no `fetch` of frames anywhere.
- `sw.js`: add `./demo/camera.html` and `./src/lib/vision-occupancy.js`, bump
  `CACHE`. The CDN model is off-origin, so the service worker ignores it — the
  page must say the first load needs network.

## Slice 3 — demo packaging (~120 lines)

`demo/samples/CREDITS.md` with 1–2 CC0/CC-BY parking-lot clips and their
sources (no video blob in the repo, on purpose), entry points from
`index.html` / `demo/atidim.html` / `offer.html`, and the README section
**«איך מריצים את הדמו»** — open the page, mark spots, what the demo shows.
