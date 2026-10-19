/* ParkWiz field shell. Cache-first for same-origin GET. Off-origin requests are ignored. */
const CACHE = 'parkwiz-field-v22';
const ASSETS = [
  './',
  './index.html',
  './offer.html',
  './pilot-kit.html',
  './pilot-calibrate.html',
  './pilot-eval.html',
  './pilot-method.html',
  './pilot-compare.html',
  './pilot-report.html',
  './pilot-summary.html',
  './pilot-privacy.html',
  './pilot-dashboard.html',
  './pilot-log.html',
  './pilot-brief.html',
  './pilot-atidim.html',
  './marketplace.html',
  './manifest.json',
  './icon.svg',
  './availability-model.js',
  // Fetched at runtime by index.html (municipal lots layer + trip planner).
  // Without it in the shell the layer silently fails on the first offline visit.
  './netanya-lots.geojson',
  './pilot/shell.css',
  './pilot/print.css',
  './pilot/sample-occupancy.json',
  './pilot/sample-spots.json',
  './pilot/sample-pairs.json',
  './pilot/sample-log.json',
  './pilot/sample-lot.svg',
  './pilot/sample-empty.svg',
  './pilot/sample-lot-dusk.svg',
  './pilot/sample-lot-night.svg',
  './pilot/sample-empty-night.svg',
  './pilot/sample-lot-wet.svg',
  './pilot/sample-lot-white.svg',
  './pilot/dataset/manifest.json',
  './pilot/dataset/labels.json',
  './src/lib/occupancy.js',
  './src/lib/heuristic.js',
  './src/lib/dataset.js',
  './src/lib/calibrate.js',
  './src/lib/compare.js',
  './src/lib/protocol.js',
  './src/lib/export.js',
  './src/lib/offer.js',
  './src/lib/contact.js',
  './src/lib/surface-nav.js',
  './src/lib/pwa.js',
  './src/lib/probability.js',
  './src/lib/availability.js',
  './src/lib/predict.js',
  './src/lib/atidim-lot.js',
  // <script src>'d by index.html for the ?site= demo preset (#261).
  './src/lib/site-preset.js',
  // <script src>'d by demo/atidim-board.html; without it the margin panel is
  // blank on the first offline visit.
  './src/lib/margin.js',
  // <script src>'d by demo/atidim.html for the spot-freed feed (#263).
  './src/lib/spot-events.js',
  // The spot-freed event core (#265). <script src>'d by demo/atidim-board.html;
  // without it the "a bay freed" alert feed is empty on the first offline visit.
  './src/lib/spot-freed.js',
  './demo/atidim.html',
  './demo/atidim-board.html',
  // Operator-editable labels for the Atidim demo.
  './demo/atidim-data.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then((hit) => {
      const fetched = fetch(event.request).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || fetched;
    })
  );
});
