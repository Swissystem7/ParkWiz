'use strict';

function normalizePlate(input) {
  const invalid = { valid: false, plate: null, formatted: null };
  if (typeof input !== 'string' && typeof input !== 'number') return invalid;

  const plate = String(input).replace(/[\s-]/g, '');
  if (!/^\d{7,8}$/.test(plate)) return invalid;

  const formatted = plate.length === 7
    ? `${plate.slice(0, 2)}-${plate.slice(2, 5)}-${plate.slice(5)}`   // XX-XXX-XX
    : `${plate.slice(0, 3)}-${plate.slice(3, 5)}-${plate.slice(5)}`;  // XXX-XX-XXX

  return { valid: true, plate, formatted };
}

module.exports = { normalizePlate };
