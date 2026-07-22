'use strict';

const ALLOWED_TYPES = new Set(['private_driveway', 'private_lot', 'garage']);

function validateListing(listing) {
  const value = listing && typeof listing === 'object' ? listing : {};
  const errors = [];
  if (!ALLOWED_TYPES.has(value.spotType)) {
    errors.push(value.spotType === 'public_curb' || value.spotType === 'street'
      ? 'Public curb and street spaces cannot be listed.'
      : 'spotType must be private_driveway, private_lot, or garage.');
  }
  if (value.ownershipAttested !== true) errors.push('Ownership or authorization attestation is required.');
  if (typeof value.address !== 'string' || !value.address.trim()) errors.push('Address is required.');
  if (!Number.isFinite(value.priceIls) || value.priceIls <= 0) errors.push('priceIls must be a positive number.');
  return { ok: errors.length === 0, errors };
}

module.exports = { validateListing };
