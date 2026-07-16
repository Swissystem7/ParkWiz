// ParkWiz — Israeli license plate normalizer. Integrated from FACT-PW-1 (draft rewritten: original had wrong regex/format).
function normalizePlate(input) {
  if (typeof input !== 'string') return { valid: false, plate: null, formatted: null };
  const clean = input.replace(/[\s-]/g, '');
  if (!/^(\d{7}|\d{8})$/.test(clean)) return { valid: false, plate: null, formatted: null };
  const formatted = clean.length === 7
    ? `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5)}`   // XX-XXX-XX
    : `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5)}`;  // XXX-XX-XXX
  return { valid: true, plate: clean, formatted };
}
module.exports = { normalizePlate };
