// ParkWiz — Node runner for the shared backend (#337).
//
//   node server/node.js                    API + static site on :8787, in memory
//   PORT=3000 PARKWIZ_DATA=data.json node server/node.js   ...and survive restarts
//
// One process = one store; each store call runs to the end before the next,
// which makes claims race-free. Never run two processes on one data file.
'use strict';
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createStore } = require('./store');
const { createApp } = require('./app');

const ROOT = path.join(__dirname, '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.geojson': 'application/geo+json', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
};

function persist(store, file) {
  if (!file) return;
  try {
    if (fs.existsSync(file)) store.load(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (err) {
    console.error('[parkwiz] could not read', file, err.message);
  }
  let timer = null;
  store.onChange(() => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      const tmp = file + '.tmp';
      try {
        fs.writeFileSync(tmp, JSON.stringify(store.toJSON()));
        fs.renameSync(tmp, file);
      } catch (err) {
        store.recordError(err, 'persist');
        console.error('[parkwiz] could not save', file, err.message);
      }
    }, 200);
    timer.unref();
  });
}

function serveStatic(req, res) {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(ROOT, rel);
  const inside = file.startsWith(ROOT + path.sep);
  if (!inside || rel.split(/[\\/]/).some((p) => p.startsWith('.') || p === 'node_modules' || p === 'server')) {
    return res.writeHead(404).end();
  }
  fs.readFile(file, (err, buf) => {
    if (err) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(buf);
  });
}

function startServer(options) {
  const opts = options || {};
  const store = opts.store || createStore();
  persist(store, opts.dataFile);
  const app = createApp(store);
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(new URL(req.url, 'http://localhost'), {
      method: req.method,
      headers: req.headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    });
    const response = await app.handle(request);
    if (!response) {
      serveStatic(req, res);
      return;
    }
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  return new Promise((resolve) => {
    server.listen(opts.port === undefined ? 8787 : opts.port, opts.host || '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ store, server, url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

if (require.main === module) {
  startServer({
    port: Number(process.env.PORT) || 8787,
    host: process.env.HOST || '127.0.0.1',
    dataFile: process.env.PARKWIZ_DATA || '',
  }).then(({ url }) => {
    console.log(`[parkwiz] shared backend on ${url}  (health: ${url}/health, live lot: ${url}/demo/live-lot.html)`);
  });
}

module.exports = { startServer };
