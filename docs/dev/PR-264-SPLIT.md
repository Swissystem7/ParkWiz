# #264 — real camera occupancy in the browser: PR split

Issue #264 is one feature but ~700 lines of code: a detection engine, a camera
page, and the offline/demo packaging. `auto_merger` rejects a PR over ~400
lines, so it ships in three slices, engine first — the other two depend on it.

## Slice 1 — the engine (landed, #279)

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

## Slice 2 — `demo/camera.html` (landed, #320)

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
- KPIs `#kpiFree` / `#kpiOcc` / `#kpiRate` / `#kpiCars`, plus `OCC.chartSvg` and
  `OCC.hourHeatmapSvg` (which buckets via `OCC.byHour`) — real detections, never
  seeded, stamped with the local wall clock: `hourFromTs` reads the literal
  `T<hh>`, so `toISOString` would file a 15:00 meeting under 13:00.
- On `state.freed`: `window.dispatchEvent(new CustomEvent('parkwiz:spot-freed',
  {detail:{spotId, source:'camera', ts}}))` + the toast, per #263.
- `test/camera-page-ui.test.js`: inline scripts parse under `vm`; every
  `VO.*` / `OCC.*` call exists in the required module; Hebrew RTL + skip link;
  the privacy claim is on the page; no `fetch` of frames anywhere.
- `sw.js`: add `./demo/camera.html` and `./src/lib/vision-occupancy.js`, bump
  `CACHE`. The CDN model is off-origin, so the service worker ignores it — the
  page must say the first load needs network.

## Slice 3 — demo packaging (this PR)

What makes the page findable and rehearsable; the detection loop needs none of
it, which is why slice 2 ships without any link into it (so the link test can
require every `href` to resolve).

- `test/camera-smoke.test.js`, the sibling of `atidim-demo-smoke.test.js`: the
  inline script under `vm` against a stub DOM, a stub 2D context and a fake
  `cocoSsd`, driving a car into a dragged bay and out again. Run as a scratch
  harness while building slice 2 — it is what proved the counters move (free 0
  / occ 1 / 100% with the car, 1 / 0 / 0% without), that exactly one
  `parkwiz:spot-freed` fires on the way out, that both charts render real
  `<svg>` and that `getUserMedia`'s tracks survive `start()`. ~100 lines, so it
  lands here rather than blowing the slice-2 budget.
- `demo/samples/CREDITS.md` — 1–2 free parking-lot clips (Pexels License) and
  their sources, plus "download one before a meeting with no wifi". No video
  blob in the repo: tens of MB do not belong in `git` or on GitHub Pages.
- Entry points from `index.html`, `demo/atidim.html` and `offer.html`; today
  `demo/camera.html` is reachable only by typing the URL.
- README section **«איך מריצים את הדמו»** — pick a source, drag the bays, what
  the counter and the two charts show, and the one-time model download.
