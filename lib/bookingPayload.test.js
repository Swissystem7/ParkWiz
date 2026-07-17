'use strict';

const assert = require('assert');
const { buildBookingPayload } = require('./bookingPayload.js');

// --- valid path: body matches POST /api/bookings contract ---
{
  const r = buildBookingPayload({
    private_spot_id: 7,
    start_ts: '2026-07-20T08:00:00.000Z',
    end_ts: '2026-07-20T12:00:00.000Z',
    price_per_hour: 10,
  });
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.payload.private_spot_id, 7);
  assert.strictEqual(r.payload.start_ts, '2026-07-20T08:00:00.000Z');
  assert.strictEqual(r.payload.end_ts, '2026-07-20T12:00:00.000Z');
  // estimate: 4h * 10 = 40 base, 15% commission = 6, host payout 34
  assert.strictEqual(r.estimate.source, 'estimate');
  assert.strictEqual(r.estimate.hours, 4);
  assert.strictEqual(r.estimate.base, 40);
  assert.strictEqual(r.estimate.commission, 6);
  assert.strictEqual(r.estimate.hostPayout, 34);
  assert.strictEqual(r.estimate.renterTotal, 40);
}

// --- string id coerces; ms-epoch and Date inputs accepted ---
{
  const start = new Date('2026-07-20T08:00:00.000Z');
  const r = buildBookingPayload({
    private_spot_id: '3',
    start_ts: start,
    end_ts: start.getTime() + 2 * 3600 * 1000,
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.payload.private_spot_id, 3);
  assert.strictEqual(r.payload.end_ts, '2026-07-20T10:00:00.000Z');
  assert.strictEqual(r.estimate, null); // no price_per_hour -> no estimate
}

// --- custom commission rate ---
{
  const r = buildBookingPayload(
    { private_spot_id: 1, start_ts: '2026-07-20T08:00:00Z', end_ts: '2026-07-20T09:00:00Z', price_per_hour: 20 },
    { commissionRate: 0.2 }
  );
  assert.strictEqual(r.estimate.base, 20);
  assert.strictEqual(r.estimate.commission, 4);
  assert.strictEqual(r.estimate.hostPayout, 16);
  assert.strictEqual(r.estimate.commissionRate, 0.2);
}

// --- out-of-band rate falls back to default 0.15 ---
{
  const r = buildBookingPayload(
    { private_spot_id: 1, start_ts: '2026-07-20T08:00:00Z', end_ts: '2026-07-20T09:00:00Z', price_per_hour: 100 },
    { commissionRate: 5 }
  );
  assert.strictEqual(r.estimate.commissionRate, 0.15);
  assert.strictEqual(r.estimate.commission, 15);
}

// --- validation failures ---
{
  const r = buildBookingPayload({ start_ts: '2026-07-20T08:00:00Z', end_ts: '2026-07-20T09:00:00Z' });
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.includes('private_spot_id'));
  assert.strictEqual(r.payload, null);
}
{
  const r = buildBookingPayload({ private_spot_id: 0, start_ts: 'x', end_ts: 'y' });
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.includes('private_spot_id'));
  assert.ok(r.errors.includes('start_ts'));
  assert.ok(r.errors.includes('end_ts'));
}
{
  // end <= start rejected (matches server endTs <= startTs guard)
  const r = buildBookingPayload({
    private_spot_id: 2,
    start_ts: '2026-07-20T12:00:00Z',
    end_ts: '2026-07-20T08:00:00Z',
  });
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.includes('end_ts_after_start'));
}
{
  // non-integer id rejected
  const r = buildBookingPayload({ private_spot_id: 2.5, start_ts: '2026-07-20T08:00:00Z', end_ts: '2026-07-20T09:00:00Z' });
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.includes('private_spot_id'));
}

console.log('bookingPayload: all assertions passed');
