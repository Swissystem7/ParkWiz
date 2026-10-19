// docs/car-android-auto.md is the one part of #267 that is a plan rather than
// code: the issue asks for an Android Auto design and a notification prototype
// plan, and explicitly for no store step. A plan rots silently, so these
// assertions pin the three things that would otherwise drift — that it stays
// design-only, that it names the real car-app APIs instead of gesturing at
// them, and that the in-car surface is held to the same opt-in and no-plates
// rules as the wire contract itself.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'car-android-auto.md'), 'utf8');

test('the Android Auto plan stays design-only, with no store step', () => {
  assert.match(doc, /Nothing is published to Google Play/);
  assert.match(doc, /no store submission/);
  // Android Automotive is named so it can be ruled out, not built: a per-OEM
  // build is the thing this issue must not quietly acquire.
  assert.match(doc, /Android Automotive/);
  assert.match(doc, /out of scope/);
  assert.match(doc, /this file is a plan and not an/);
  // No Android sources may land under this issue either.
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'app')), false);
});

test('the plan names the Android car-app APIs it would actually build on', () => {
  assert.match(doc, /androidx\.car\.app/);
  assert.match(doc, /CarAppService/);
  assert.match(doc, /PlaceListMapTemplate/);
  assert.match(doc, /MessageTemplate/);
  assert.match(doc, /NotificationCompat/);
  assert.match(doc, /CarAppExtender/);
  assert.match(doc, /CATEGORY_NAVIGATION/);
  // Driving-state limits are a template rule, not a style preference.
  assert.match(doc, /above 6/);
});

test('the in-car surface carries the contract events and the privacy rules', () => {
  for (const type of ['spot-freed', 'spot-claim', 'spot-release']) {
    assert.match(doc, new RegExp(type));
  }
  assert.match(doc, /ttlS/);
  assert.match(doc, /rankSpots/);
  assert.match(doc, /Opt-in is a ParkWiz app setting, off by default/);
  // The car is one more subscriber, so the no-identity rule applies there too.
  assert.match(doc, /never sees a plate, a VIN or a phone number/);
  assert.match(doc, /Location stays on the phone/);
  assert.match(doc, /No microphone, no camera, no contacts, no driver identity/);
});

test('the Hebrew driver-facing strings in the plan stay Hebrew', () => {
  // ParkWiz drivers are Israeli; an in-car string reviewed in English would
  // ship in English. The plan quotes the actual action labels.
  assert.match(doc, /נווט לשם/);
  assert.match(doc, /לא עכשיו/);
  assert.match(doc, /read aloud/);
});
