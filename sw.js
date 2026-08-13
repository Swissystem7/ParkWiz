/* ParkWiz field shell. Cache-first for same-origin GET. Off-origin requests are ignored. */
const CACHE = 'parkwiz-field-v2';
const ASSETS = [
  './',
  './index.html',
  './pilot-kit.html',
  './pilot-compare.html',
  './pilot-report.html',
  './pilot-summary.html',
  './pilot-privacy.html',
  './pilot-dashboard.html',
  './pilot-log.html',
  './pilot-brief.html',
  './marketplace.html',
  './manifest.json',
  './icon.svg',
  './pilot/shell.css',
  './pilot/print.css',
  './pilot/sample-occupancy.json',
  './pilot/sample-spots.json',
  './pilot/sample-pairs.json',
  './pilot/sample-log.json',
  './src/lib/occupancy.js',
  './src/lib/heuristic.js',
  './src/lib/compare.js',
  './src/lib/protocol.js',
  './src/lib/export.js',
  './src/lib/surface-nav.js',
  './src/lib/pwa.js',
  './src/lib/probability.js',
  './src/lib/availability.js',
  './src/lib/predict.js',
  './src/lib/plate.js',
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
