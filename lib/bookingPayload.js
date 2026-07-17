'use strict';

// Turns a raw "book this spot" form into a validated POST /api/bookings body,
// plus a client-side price ESTIMATE for UX preview.
// Mirrors the backend contract in parkwiz-backend/routes/bookings.js exactly:
//   private_spot_id (int > 0), start_ts + end_ts (parseable dates, end > start).
// The SERVER is authoritative on price (durationHours * price_per_hour); the
// estimate here is preview-only and must be labelled as such in the UI.
//
// Commission model (JustPark/SpotHero standard): host lists price_per_hour,
// renter pays the base, platform deducts commission from the HOST payout.
// ponytail: single fee model (host-side, default 15%). If product decides the
// fee is renter-side instead, flip hostPayout/renterTotal — see QUESTIONS.md.

function num(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') return Number(v);
  return NaN;
}

function round2(n) {
  return Number(n.toFixed(2));
}

// Accepts a Date, an ISO/parseable string, or ms epoch; returns a valid Date or null.
function toDate(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string' && v.trim() !== '') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function buildBookingPayload(form, opts) {
  const f = form || {};
  const o = opts || {};
  const errors = [];

  const rawId = num(f.private_spot_id);
  const private_spot_id = Number.isInteger(rawId) && rawId > 0 ? rawId : null;
  if (private_spot_id === null) errors.push('private_spot_id');

  const start = toDate(f.start_ts);
  if (!start) errors.push('start_ts');

  const end = toDate(f.end_ts);
  if (!end) errors.push('end_ts');

  if (start && end && end <= start) errors.push('end_ts_after_start');

  if (errors.length) return { ok: false, errors, payload: null, estimate: null };

  // commission rate: clamp to a sane [0, 0.5] band; default 15%.
  let rate = num(o.commissionRate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 0.5) rate = 0.15;

  const hours = round2((end.getTime() - start.getTime()) / (1000 * 60 * 60));

  // price_per_hour is only needed for the preview estimate, not for the POST body.
  const pph = num(f.price_per_hour);
  let estimate = null;
  if (Number.isFinite(pph) && pph >= 0) {
    const base = round2(hours * pph);
    const commission = round2(base * rate);
    estimate = {
      source: 'estimate', // server is authoritative on final price
      hours,
      pricePerHour: pph,
      base, // what the renter pays
      commissionRate: rate,
      commission, // platform take
      hostPayout: round2(base - commission),
      renterTotal: base,
    };
  }

  return {
    ok: true,
    errors: [],
    payload: {
      private_spot_id,
      start_ts: start.toISOString(),
      end_ts: end.toISOString(),
    },
    estimate,
  };
}

module.exports = { buildBookingPayload };
