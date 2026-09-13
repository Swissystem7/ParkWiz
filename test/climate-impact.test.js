const test = require('node:test');
const assert = require('node:assert/strict');
const { estimateScenario } = require('../climate-impact');

test('calculates a transparent scenario without rounding away evidence', () => {
  const result = estimateScenario({
    searchesPerDay: 100,
    baselineMinutes: 8,
    assistedMinutes: 5,
    litresPerHour: 0.8,
    kgCo2ePerLitre: 2.31,
    evaluationDays: 30
  });
  assert.equal(result.savedMinutesPerSearch, 3);
  assert.equal(result.savedVehicleHours, 150);
  assert.equal(result.fuelLitresAvoided, 120);
  assert.equal(result.kgCo2eAvoided, 277.2);
});

test('never reports negative savings when the assisted route is slower', () => {
  const result = estimateScenario({
    searchesPerDay: 10,
    baselineMinutes: 4,
    assistedMinutes: 7,
    litresPerHour: 1,
    kgCo2ePerLitre: 2.31,
    evaluationDays: 1
  });
  assert.equal(result.savedMinutesPerSearch, 0);
  assert.equal(result.kgCo2eAvoided, 0);
});

test('rejects invalid assumptions instead of producing a persuasive number', () => {
  assert.throws(() => estimateScenario({
    searchesPerDay: -1,
    baselineMinutes: 4,
    assistedMinutes: 3,
    litresPerHour: 1,
    kgCo2ePerLitre: 2.31,
    evaluationDays: 1
  }), /searchesPerDay/);
});
