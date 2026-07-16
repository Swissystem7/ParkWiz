'use strict';

const assert = require('node:assert');
const { buildSpotPayload } = require('./spotPayload.js');

// Happy path: strings from a form get coerced and trimmed.
assert.deepStrictEqual(
  buildSpotPayload({ address: '  דיזנגוף 100  ', lat: '32.08', lng: '34.77', price_per_hour: '12' }),
  {
    ok: true,
    errors: [],
    payload: {
      address: 'דיזנגוף 100',
      lat: 32.08,
      lng: 34.77,
      price_per_hour: 12,
      vehicle_max_length: null,
      availability_calendar: {},
    },
  }
);

// Optional vehicle_max_length + calendar preserved.
const withOpts = buildSpotPayload({
  address: 'א', lat: 32, lng: 34, price_per_hour: 0, vehicle_max_length: '5',
  availability_calendar: { mon: ['08:00-18:00'] },
});
assert.strictEqual(withOpts.ok, true);
assert.strictEqual(withOpts.payload.vehicle_max_length, 5);
assert.strictEqual(withOpts.payload.price_per_hour, 0); // free is valid
assert.deepStrictEqual(withOpts.payload.availability_calendar, { mon: ['08:00-18:00'] });

// Non-positive / bad max length -> null (not an error).
assert.strictEqual(buildSpotPayload({ address: 'a', lat: 32, lng: 34, price_per_hour: 5, vehicle_max_length: 'xx' }).payload.vehicle_max_length, null);
assert.strictEqual(buildSpotPayload({ address: 'a', lat: 32, lng: 34, price_per_hour: 5, vehicle_max_length: -3 }).payload.vehicle_max_length, null);

// Missing / invalid fields collect errors, no payload.
assert.deepStrictEqual(buildSpotPayload({}), { ok: false, errors: ['address', 'lat', 'lng', 'price_per_hour'], payload: null });
assert.deepStrictEqual(buildSpotPayload({ address: '   ', lat: 32, lng: 34, price_per_hour: 5 }).errors, ['address']);
assert.deepStrictEqual(buildSpotPayload({ address: 'a', lat: 999, lng: 34, price_per_hour: 5 }).errors, ['lat']);
assert.deepStrictEqual(buildSpotPayload({ address: 'a', lat: 32, lng: 34, price_per_hour: -1 }).errors, ['price_per_hour']);

// Null/garbage input doesn't throw.
assert.strictEqual(buildSpotPayload(null).ok, false);
assert.strictEqual(buildSpotPayload(undefined).ok, false);

console.log('all tests passed');
