'use strict';

const STANDARD_TAKE_RATE = 0.15;

function positiveNumber(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${name} must be a positive number`);
}

function nonEmpty(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} is required`);
  return value.trim();
}

function demoCommission(priceIls, opts = {}) {
  positiveNumber(priceIls, 'priceIls');
  return opts.launch === true ? 0 : Number((priceIls * STANDARD_TAKE_RATE).toFixed(2));
}

function createBooking({ spotId, hostId, driverId, priceIls, windowMins } = {}) {
  const cleanSpotId = nonEmpty(spotId, 'spotId');
  const cleanHostId = nonEmpty(hostId, 'hostId');
  const cleanDriverId = nonEmpty(driverId, 'driverId');
  positiveNumber(priceIls, 'priceIls');
  positiveNumber(windowMins, 'windowMins');
  return Object.freeze({
    id: `demo-${cleanSpotId}-${cleanDriverId}-${windowMins}`,
    spotId: cleanSpotId,
    hostId: cleanHostId,
    driverId: cleanDriverId,
    priceIls,
    windowMins,
    heldAt: 0,
    releaseAt: windowMins * 60 * 1000,
    status: 'held',
    paymentMode: 'demo',
  });
}

function ensureHeld(booking) {
  if (!booking || booking.status !== 'held') throw new Error('booking must be held');
}

function releaseFunds(booking, now) {
  ensureHeld(booking);
  if (!Number.isFinite(now)) throw new TypeError('now must be a finite timestamp');
  if (now < booking.releaseAt) throw new Error('booking window has not elapsed');
  return Object.freeze({ ...booking, status: 'released', releasedAt: now });
}

function refund(booking) {
  ensureHeld(booking);
  return Object.freeze({ ...booking, status: 'refunded' });
}

module.exports = { createBooking, releaseFunds, refund, demoCommission };
