'use strict';

const assert = require('node:assert');
const { haversineMeters } = require('./haversineMeters.js');

// Edge: identical points -> 0
assert.strictEqual(haversineMeters(32.08, 34.78, 32.08, 34.78), 0);

// Edge: equator, 1 degree of longitude ~= 111.19 km
const oneDegLng = haversineMeters(0, 0, 0, 1);
assert.ok(Math.abs(oneDegLng - 111194.9) < 1, `equator 1deg lng: ${oneDegLng}`);

// Edge: 1 degree of latitude ~= 111.19 km (meridian)
const oneDegLat = haversineMeters(0, 0, 1, 0);
assert.ok(Math.abs(oneDegLat - 111194.9) < 1, `1deg lat: ${oneDegLat}`);

// Normal: known distance TLV -> Jerusalem ~ 54 km
const tlvJlm = haversineMeters(32.0853, 34.7818, 31.7683, 35.2137);
assert.ok(Math.abs(tlvJlm - 54000) < 2000, `TLV-JLM: ${tlvJlm}`);

// Edge: antipodal points -> ~pi*R, no NaN from float drift
const anti = haversineMeters(0, 0, 0, 180);
assert.ok(!Number.isNaN(anti), 'antipodal not NaN');
assert.ok(Math.abs(anti - Math.PI * 6371000) < 1, `antipodal: ${anti}`);

// Edge: symmetry — order of points does not matter
assert.strictEqual(
  haversineMeters(40.0, -74.0, 34.0, -118.0),
  haversineMeters(34.0, -118.0, 40.0, -74.0)
);

// Edge: negative/mixed hemispheres return a finite positive number
const cross = haversineMeters(-33.87, 151.21, 51.51, -0.13);
assert.ok(cross > 0 && Number.isFinite(cross), `cross-hemisphere: ${cross}`);

console.log('all haversineMeters tests passed');