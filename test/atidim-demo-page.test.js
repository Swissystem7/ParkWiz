'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const demoPath = path.join(root, 'demo', 'atidim.html');

test('demo/atidim.html exists and is non-empty', () => {
  assert.ok(fs.existsSync(demoPath), 'demo/atidim.html must exist');
  const stat = fs.statSync(demoPath);
  assert.ok(stat.size > 500, 'file size should be substantial');
});

test('demo/atidim.html is Hebrew RTL with mobile-ready viewport', () => {
  const html = fs.readFileSync(demoPath, 'utf8');
  assert.match(html, /lang="he"/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
});

test('demo/atidim.html works completely offline (no CDNs)', () => {
  const html = fs.readFileSync(demoPath, 'utf8');
  assert.doesNotMatch(html, /https?:\/\/(unpkg|cdnjs|cdn|fonts\.googleapis|ajax\.googleapis)/i);
});

test('demo/atidim.html includes all required operator components', () => {
  const html = fs.readFileSync(demoPath, 'utf8');
  // 1. Camera stream / canvas with overlay
  assert.match(html, /<canvas id="lotCanvas"/);
  assert.match(html, /הצג שכבת זיהוי תאים/);
  // 2. Live count
  assert.match(html, /id="kpiAvailable"/);
  assert.match(html, /מקומות פנויים כעת/);
  // 3. Hourly occupancy chart
  assert.match(html, /id="hourlyChart"/);
  assert.match(html, /התפלגות תפוסה יומית/);
  // 4. How it works with existing cameras
  assert.match(html, /איך זה עובד עם המצלמות הקיימות שלכם/);
  assert.match(html, /RTSP/);
  // 5. Privacy guarantee
  assert.match(html, /פרטיות מובטחת/);
  assert.match(html, /ללא זיהוי לוחיות רישוי/);
  // 6. Contact / CTA
  assert.match(html, /פיילוט ללא עלות/);
  assert.match(html, /offer\.html/);
  // 7. Offline PWA icon and service worker registration
  assert.match(html, /<link rel="icon" href="\.\.\/icon\.svg">/);
  assert.match(html, /navigator\.serviceWorker\.register\('\.\.\/sw\.js'/);
});

test('index.html and offer.html provide direct entry points to demo/atidim.html', () => {
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(indexHtml, /href="\.\/demo\/atidim\.html"/);
  assert.match(indexHtml, /פארק עתידים/);

  const offerHtml = fs.readFileSync(path.join(root, 'offer.html'), 'utf8');
  assert.match(offerHtml, /href="\.\/demo\/atidim\.html"/);
  assert.match(offerHtml, /דמו מפעיל חניון/);
});
