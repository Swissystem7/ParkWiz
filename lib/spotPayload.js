'use strict';

// Turns a raw "host your parking" form into a validated POST /api/spots body.
// Mirrors the backend contract in parkwiz-backend/routes/spots.js exactly:
// address (non-empty), lat/lng/price_per_hour (finite numbers) required;
// vehicle_max_length optional (null when absent); availability_calendar object.

function num(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') return Number(v);
  return NaN;
}

function buildSpotPayload(form) {
  const f = form || {};
  const errors = [];

  const address = typeof f.address === 'string' ? f.address.trim() : '';
  if (!address) errors.push('address');

  const lat = num(f.lat);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.push('lat');

  const lng = num(f.lng);
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.push('lng');

  const price = num(f.price_per_hour);
  if (!Number.isFinite(price) || price < 0) errors.push('price_per_hour');

  const rawMax = num(f.vehicle_max_length);
  const vehicle_max_length = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : null;

  const availability_calendar =
    f.availability_calendar && typeof f.availability_calendar === 'object'
      ? f.availability_calendar
      : {};

  if (errors.length) return { ok: false, errors, payload: null };

  return {
    ok: true,
    errors: [],
    payload: { address, lat, lng, price_per_hour: price, vehicle_max_length, availability_calendar },
  };
}

module.exports = { buildSpotPayload };
