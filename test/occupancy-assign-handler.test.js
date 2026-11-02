const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const handler = require('../api/assign');
const { createService, ETA_BASE_SEC, ETA_STALL_SEC } = require('../src/lib/occupancy-assign/assign');

const FIXTURE = path.join(__dirname, 'fixtures', 'pipeline-out.sample.json');
const frames = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    raw: undefined,
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    end(payload) {
      this.raw = payload;
      this.json = payload ? JSON.parse(payload) : null;
    },
  };
}

async function call(userHandler, body, method) {
  const res = mockRes();
  const req = {
    method: method || 'POST',
    body,
  };
  await userHandler(req, res);
  return res;
}

test('the Vercel export is a function', () => {
  assert.equal(typeof handler, 'function');
  assert.equal(typeof handler.createHandler, 'function');
});

test('POST simple JSON assigns, then a stale body cannot unclaim', async () => {
  const service = createService({ now: () => Date.parse('2026-11-02T12:00:30.000Z') });
  const app = handler.createHandler(service);
  const ok = await call(app, {
    spots: [
      { spot_id: 'A-4', status: 'occupied', ts: '2026-11-02T12:00:00.000Z' },
      { spot_id: 'A-2', status: 'free', ts: '2026-11-02T12:00:00.000Z' },
      { spot_id: 'B-1', status: 'free', ts: '2026-11-02T12:00:00.000Z' },
    ],
    driver: { entry: 'north', zone: 'A' },
  });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.headers['content-type'], 'application/json; charset=utf-8');
  assert.deepEqual(ok.json, { zone: 'A', spot: 'A-2', eta: ETA_BASE_SEC + 2 * ETA_STALL_SEC });

  const stale = await call(app, JSON.stringify({
    spots: [{ spot_id: 'A-2', status: 'free', ts: '2026-11-02T12:00:00.000Z' }],
    driver: { zone: 'A' },
  }));
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json.error, 'NO_FREE_SPOT');
  assert.equal(service.snapshot()['A-2'].status, 'occupied');
  assert.equal(service.snapshot()['B-1'].status, 'free');
});

test('POST pipeline fixture assigns the stall the later frame freed', async () => {
  const app = handler.createHandler(createService({ now: () => Date.parse('2012-12-20T10:00:09.000Z') }));
  const res = await call(app, Buffer.from(JSON.stringify(frames)));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json, {
    zone: 'main',
    spot: '3',
    eta: ETA_BASE_SEC + 3 * ETA_STALL_SEC,
  });

  const onlyFull = await call(
    handler.createHandler(createService({ now: () => Date.parse('2012-12-20T10:00:04.000Z') })),
    { frames: [frames[0]], driver: { zone: 'main' } },
  );
  assert.equal(onlyFull.statusCode, 409);
  assert.equal(onlyFull.json.error, 'NO_FREE_SPOT');
  assert.match(onlyFull.json.message, /main/);
});

test('validation and method errors are 4xx and do not change stored spots', async () => {
  const service = createService({ now: () => Date.parse('2026-11-02T12:00:30.000Z') });
  const app = handler.createHandler(service);
  await call(app, {
    spots: [
      { spot_id: '7', status: 'free', ts: '2026-11-02T12:00:00.000Z' },
      { spot_id: '8', status: 'free', ts: '2026-11-02T12:00:00.000Z' },
    ],
  });

  const bad = await call(app, {
    spots: [{ spot_id: '8', status: 'empty', ts: '2026-11-02T12:00:05.000Z' }],
  });
  assert.equal(bad.statusCode, 400);
  assert.equal(bad.json.error, 'BAD_STATUS');
  assert.match(bad.json.message, /status/);
  assert.equal(service.snapshot()['7'].status, 'occupied');
  assert.equal(service.snapshot()['8'].status, 'free');

  const json = await call(app, '{');
  assert.equal(json.statusCode, 400);
  assert.equal(json.json.error, 'BAD_JSON');

  const empty = await call(app, '');
  assert.equal(empty.statusCode, 400);
  assert.equal(empty.json.error, 'BAD_JSON');

  const get = await call(app, { spots: [] }, 'GET');
  assert.equal(get.statusCode, 405);
  assert.equal(get.json.error, 'METHOD_NOT_ALLOWED');
  assert.equal(get.headers.allow, 'POST, OPTIONS');

  const opt = await call(app, null, 'OPTIONS');
  assert.equal(opt.statusCode, 204);
  assert.equal(opt.json, null);

  const huge = await call(app, 'x'.repeat(512 * 1024 + 1));
  assert.equal(huge.statusCode, 413);
  assert.equal(huge.json.error, 'TOO_LARGE');
});

test('a raw request stream is parsed, and a huge stream is refused', async () => {
  const service = createService({ now: () => Date.parse('2026-11-02T12:00:30.000Z') });
  const app = handler.createHandler(service);

  const req = new EventEmitter();
  req.method = 'POST';
  const res = mockRes();
  const pending = app(req, res);
  const payload = JSON.stringify({
    spots: [{ spot_id: '9', status: 'free', ts: '2026-11-02T12:00:00.000Z' }],
  });
  req.emit('data', payload.slice(0, 10));
  req.emit('data', payload.slice(10));
  req.emit('end');
  await pending;
  assert.equal(res.statusCode, 200);
  assert.equal(res.json.spot, '9');

  const big = new EventEmitter();
  big.method = 'POST';
  const bigRes = mockRes();
  const bigPending = app(big, bigRes);
  big.emit('data', 'x'.repeat(512 * 1024));
  big.emit('data', 'yyyy');
  big.emit('end');
  await bigPending;
  assert.equal(bigRes.statusCode, 413);
  assert.equal(service.snapshot()['9'].status, 'occupied');
});

test('unexpected failures stay generic', async () => {
  const app = handler.createHandler({
    ingestAndAssign() { throw new Error('disk path /secret'); },
  });
  const orig = console.error;
  console.error = () => {};
  try {
    const res = await call(app, { spots: [] });
    assert.equal(res.statusCode, 500);
    assert.equal(res.json.error, 'INTERNAL');
    assert.equal(JSON.stringify(res.json).includes('secret'), false);
  } finally {
    console.error = orig;
  }
});

test('a request stream error is a generic 500', async () => {
  const app = handler.createHandler(createService());
  const req = new EventEmitter();
  req.method = 'POST';
  const res = mockRes();
  const orig = console.error;
  console.error = () => {};
  try {
    const pending = app(req, res);
    req.emit('error', new Error('socket reset'));
    await pending;
    assert.equal(res.statusCode, 500);
    assert.equal(res.json.error, 'INTERNAL');
  } finally {
    console.error = orig;
  }
});

test('numeric JSON and a missing stream are 400', async () => {
  const app = handler.createHandler(createService());
  const num = await call(app, 4);
  assert.equal(num.statusCode, 400);
  assert.equal(num.json.error, 'BAD_JSON');

  const res = mockRes();
  await app({ method: 'POST' }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.json.error, 'BAD_JSON');
});
