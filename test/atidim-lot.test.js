'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const lotModel = require('../src/lib/atidim-lot');

test('ATIDIM_LOT metadata is immutable and well-formed', () => {
  assert.equal(lotModel.ATIDIM_LOT.id, 'atidim');
  assert.equal(lotModel.ATIDIM_LOT.totalCapacity, 220);
  assert.equal(lotModel.ATIDIM_LOT.zones.length, 3);
  assert.equal(lotModel.ATIDIM_LOT.cameras.length, 3);
  assert.ok(Object.isFrozen(lotModel.ATIDIM_LOT));
  assert.throws(() => {
    lotModel.ATIDIM_LOT.totalCapacity = 999;
  }, /TypeError/);
});

test('getHourlyCurve returns 24 hours with realistic park peak hours', () => {
  const curve = lotModel.getHourlyCurve();
  assert.equal(curve.length, 24);
  assert.equal(curve[0].label, '00:00');
  assert.equal(curve[12].label, '12:00');
  // 10:00 - 14:00 must be peak hours (>= 85%)
  assert.ok(curve[10].rate >= 0.85);
  assert.ok(curve[10].isPeak);
  assert.ok(curve[14].rate >= 0.85);
  // Night hours must be low
  assert.ok(curve[3].rate < 0.15);
  assert.equal(curve[10].occupied + curve[10].available, 220);
});

test('hourlyPoint wraps hour 24/-1/NaN to 0..23', () => {
  assert.equal(lotModel.hourlyPoint(24).hour, 0);
  assert.equal(lotModel.hourlyPoint(-1).hour, 23);
  assert.equal(lotModel.hourlyPoint(NaN).hour, 0);
});

test('createDefaultCameraSpots produces 24 normalized spot boxes', () => {
  const spots = lotModel.createDefaultCameraSpots();
  assert.equal(spots.length, 24);
  for (const s of spots) {
    assert.ok(s.id.startsWith('A-'));
    assert.ok(s.x >= 0 && s.x <= 1);
    assert.ok(s.y >= 0 && s.y <= 1);
    assert.ok(s.w > 0 && s.w <= 1);
    assert.ok(s.h > 0 && s.h <= 1);
    assert.equal(typeof s.occupied, 'boolean');
    assert.ok(s.confidence >= 0.8 && s.confidence <= 1);
  }
});

test('calculateOccupancy calculates accurate and clamped metrics', () => {
  const spots = [
    { id: '1', occupied: true },
    { id: '2', occupied: false },
    { id: '3', occupied: true },
    { id: '4', occupied: false },
  ];
  const res = lotModel.calculateOccupancy(spots, 100);
  assert.equal(res.capacity, 100);
  assert.equal(res.totalInView, 4);
  assert.equal(res.occupiedInView, 2);
  assert.equal(res.availableInView, 2);
  assert.equal(res.rate, 0.5);
  assert.equal(res.percentage, 50);
  assert.equal(res.estimatedLotOccupied, 50);
  assert.equal(res.available, 50);
});

test('calculateOccupancy handles empty or bad input gracefully', () => {
  const res = lotModel.calculateOccupancy([], 220);
  assert.equal(res.occupiedInView, 0);
  assert.equal(res.estimatedLotOccupied, 0);
  assert.equal(res.available, 220);
  assert.equal(res.rate, 0);

  const resNull = lotModel.calculateOccupancy(null, 0);
  assert.equal(resNull.capacity, 220);
});

test('transitionSpot toggles or performs arrive/leave correctly', () => {
  const spots = [
    { id: '1', occupied: false },
    { id: '2', occupied: true },
  ];
  const arrived = lotModel.transitionSpot(spots, 'arrive');
  assert.ok(arrived.every((s) => s.occupied));

  const left = lotModel.transitionSpot(arrived, 'leave');
  assert.ok(left.some((s) => !s.occupied));
});

test('validatePrivacyCompliance detects forbidden PII/LPR and allows clean payloads', () => {
  const cleanRecord = {
    timestamp: '2026-10-13T16:00:00Z',
    cameraId: 'cam-01',
    spotId: 'A-01',
    occupied: true,
    confidence: 0.94,
  };
  const cleanResult = lotModel.validatePrivacyCompliance(cleanRecord);
  assert.ok(cleanResult.valid);
  assert.equal(cleanResult.violations.length, 0);

  const dirtyRecord = {
    timestamp: '2026-10-13T16:00:00Z',
    spotId: 'A-01',
    licensePlate: '12-345-67',
    faceIdent: 'person_01',
  };
  const dirtyResult = lotModel.validatePrivacyCompliance(dirtyRecord);
  assert.equal(dirtyResult.valid, false);
  assert.ok(dirtyResult.violations.includes('licensePlate'));
  assert.ok(dirtyResult.violations.includes('faceIdent'));
});
