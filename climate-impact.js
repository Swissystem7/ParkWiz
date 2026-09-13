(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ParkWizClimateImpact = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function finiteNonNegative(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      throw new RangeError(`${name} must be a finite, non-negative number`);
    }
    return number;
  }

  function estimateScenario(input) {
    const searchesPerDay = finiteNonNegative(input.searchesPerDay, 'searchesPerDay');
    const baselineMinutes = finiteNonNegative(input.baselineMinutes, 'baselineMinutes');
    const assistedMinutes = finiteNonNegative(input.assistedMinutes, 'assistedMinutes');
    const litresPerHour = finiteNonNegative(input.litresPerHour, 'litresPerHour');
    const kgCo2ePerLitre = finiteNonNegative(input.kgCo2ePerLitre, 'kgCo2ePerLitre');
    const evaluationDays = finiteNonNegative(input.evaluationDays, 'evaluationDays');

    const savedMinutesPerSearch = Math.max(0, baselineMinutes - assistedMinutes);
    const savedVehicleHours = searchesPerDay * evaluationDays * savedMinutesPerSearch / 60;
    const fuelLitresAvoided = savedVehicleHours * litresPerHour;
    const kgCo2eAvoided = fuelLitresAvoided * kgCo2ePerLitre;

    return {
      savedMinutesPerSearch,
      savedVehicleHours,
      fuelLitresAvoided,
      kgCo2eAvoided
    };
  }

  return { estimateScenario };
});
