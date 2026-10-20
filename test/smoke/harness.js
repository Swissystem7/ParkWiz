// Shared harness for the 390px phone smoke tests (test/smoke/*.smoke.js).
// Runs fully offline: the repo is served from a local static server, Leaflet is
// served from node_modules instead of unpkg, map tiles get a blank PNG and any
// other outside request is aborted and reported.
'use strict';
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const leafletDist = path.join(root, 'node_modules', 'leaflet', 'dist');
const WIDTH = 390;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.geojson': 'application/geo+json', '.svg': 'image/svg+xml', '.png': 'image/png',
};
// 1x1 transparent PNG standing in for OpenStreetMap tiles.
const BLANK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function openPage(browser, base, { page: pagePath = 'index.html', leaflet = true, settleMs = 1500 } = {}) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    locale: 'he-IL', timezoneId: 'Asia/Jerusalem', serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const errors = [];
  const external = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));
  page.on('response', (r) => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin === base) return route.continue();
    if (url.hostname === 'unpkg.com' && leaflet) {
      const m = /^\/leaflet@[\d.]+\/dist\/(.+)$/.exec(url.pathname);
      const file = m && path.join(leafletDist, m[1]);
      if (file && fs.existsSync(file)) {
        return route.fulfill({ contentType: TYPES[path.extname(file)] || 'image/png', body: fs.readFileSync(file) });
      }
    }
    if (/(^|\.)tile\.openstreetmap\.org$/.test(url.hostname)) {
      return route.fulfill({ contentType: 'image/png', body: BLANK_PNG });
    }
    external.push(url.href);
    return route.abort('internetdisconnected');
  });
  await page.goto(base + '/' + pagePath, { waitUntil: 'load' });
  // Let the deferred boot work (geojson fetch, map layers, timers) settle.
  await page.waitForTimeout(settleMs);
  return { context, page, errors, external };
}

// Visible elements whose box sticks out past either side of the viewport.
// Leaflet's own panes are skipped: the map deliberately draws tiles off-screen.
// Children of a clipping/scrolling row (e.g. the swipeable top nav) are skipped
// too; the row itself is still checked.
function overflowing(page) {
  return page.evaluate((width) => {
    const clipped = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (getComputedStyle(p).overflowX !== 'visible') return true;
      }
      return false;
    };
    const out = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (el.closest('.leaflet-container, .skip-link, script, style') || clipped(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed' && cs.opacity === '0') continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.left < -1 || r.right > width + 1) {
        out.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} [${Math.round(r.left)}..${Math.round(r.right)}]`);
      }
    }
    return { scrollWidth: document.documentElement.scrollWidth, out: out.slice(0, 15) };
  }, WIDTH);
}

module.exports = { WIDTH, serve, openPage, overflowing };
