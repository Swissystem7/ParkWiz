// ParkWiz — Israeli license plate normalizer.
//
// Single source of truth. Previously this logic existed twice: once here (as a
// factory module, covered by tests) and once inlined in index.html. The two had
// drifted — the inlined copy also accepted numbers, so normalizePlate(1234567)
// was valid in the browser and invalid under test. The strict, documented
// contract below wins: input must be a string. Every call site already passes
// the raw value of a text field, so no caller changes behaviour.
//
// Accepted formats: 7 digits -> XX-XXX-XX, 8 digits -> XXX-XX-XXX.
// Spaces and dashes in the input are ignored.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const INVALID = Object.freeze({ valid: false, plate: null, formatted: null });

  function normalizePlate(input) {
    if (typeof input !== 'string') return { ...INVALID };
    const plate = input.replace(/[\s-]/g, '');
    if (!/^\d{7,8}$/.test(plate)) return { ...INVALID };
    const formatted = plate.length === 7
      ? `${plate.slice(0, 2)}-${plate.slice(2, 5)}-${plate.slice(5)}`
      : `${plate.slice(0, 3)}-${plate.slice(3, 5)}-${plate.slice(5)}`;
    return { valid: true, plate, formatted };
  }

  return { normalizePlate };
});
