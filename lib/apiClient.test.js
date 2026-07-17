'use strict';
const assert = require('assert');
const { createClient, ValidationError } = require('./apiClient');

// --- mock fetch: records calls, returns canned responses ---
function mockFetch(script) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const r = script.shift();
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.body,
    };
  };
  fn.calls = calls;
  return fn;
}

(async () => {
  // register captures token + sends right shape
  let f = mockFetch([{ status: 201, body: { user: { id: 1 }, token: 'TKN' } }]);
  let c = createClient({ baseUrl: 'http://x:4000/', fetch: f });
  const reg = await c.register('a@b.co', 'pw12345678', 'Amy');
  assert.strictEqual(c.token, 'TKN', 'token captured from register');
  assert.strictEqual(f.calls[0].url, 'http://x:4000/api/auth/register', 'trailing slash trimmed');
  assert.strictEqual(f.calls[0].init.method, 'POST');
  assert.deepStrictEqual(JSON.parse(f.calls[0].init.body),
    { email: 'a@b.co', password: 'pw12345678', display_name: 'Amy' });
  assert.ok(!f.calls[0].init.headers.Authorization, 'register is unauthenticated');

  // createSpot sends Bearer + validated payload (vehicle_max_length omitted -> null)
  f = mockFetch([{ status: 201, body: { id: 9 } }]);
  c = createClient({ fetch: f, token: 'TKN' });
  await c.createSpot({ address: 'הרצל 1', lat: 32.07, lng: 34.78, price_per_hour: 12 });
  assert.strictEqual(f.calls[0].init.headers.Authorization, 'Bearer TKN', 'spot carries token');
  const spotBody = JSON.parse(f.calls[0].init.body);
  assert.strictEqual(spotBody.vehicle_max_length, null, 'optional field normalized to null');
  assert.strictEqual(spotBody.price_per_hour, 12);

  // createBooking returns {server, estimate}; body has only the 3 contract fields
  f = mockFetch([{ status: 201, body: { booking: { id: 3, price: '12' }, payment: { status: 'pending' } } }]);
  c = createClient({ fetch: f, token: 'TKN' });
  const now = 1700000000000;
  const res = await c.createBooking({
    private_spot_id: 4,
    start_ts: new Date(now).toISOString(),
    end_ts: new Date(now + 3600e3).toISOString(),
    price_per_hour: 12,
  });
  const bkBody = JSON.parse(f.calls[0].init.body);
  assert.deepStrictEqual(Object.keys(bkBody).sort(), ['end_ts', 'private_spot_id', 'start_ts'],
    'booking body carries only contract fields (no price_per_hour leak)');
  assert.strictEqual(res.server.booking.id, 3);
  assert.strictEqual(res.estimate.source, 'estimate');
  assert.strictEqual(res.estimate.hostPayout, 10.2, '12 base - 15% = 10.2 host payout');

  // invalid form -> ValidationError, no fetch
  f = mockFetch([]);
  c = createClient({ fetch: f, token: 'TKN' });
  assert.throws(() => c.createSpot({ address: '', lat: 999 }),
    (e) => e.name === 'ValidationError' && e.fields.includes('address') && e.fields.includes('lat'),
    'bad spot form throws ValidationError before any fetch');
  assert.strictEqual(f.calls.length, 0, 'no request sent on validation failure');

  // authenticated call without token -> throws
  c = createClient({ fetch: mockFetch([]) });
  await assert.rejects(() => c.createSpot({ address: 'x', lat: 1, lng: 1, price_per_hour: 1 }),
    /not authenticated/);

  // non-2xx surfaces server error message + status
  f = mockFetch([{ status: 401, body: { error: 'Invalid credentials' } }]);
  c = createClient({ fetch: f });
  await assert.rejects(() => c.login('a@b.co', 'bad'),
    (e) => e.message === 'Invalid credentials' && e.status === 401);

  console.log('apiClient.test.js: all assertions passed');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
