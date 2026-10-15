'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const lot = require('../src/lib/atidim-lot');

const root = path.join(__dirname, '..');
const pitchPath = path.join(root, 'docs', 'CITYZONE_ATIDIM_PITCH.md');
const launchPath = path.join(root, 'docs', 'launch', 'CITYZONE-ATIDIM.md');

test('docs/CITYZONE_ATIDIM_PITCH.md exists and covers all operator meeting essentials', () => {
  assert.ok(fs.existsSync(pitchPath), 'pitch doc must exist');
  const content = fs.readFileSync(pitchPath, 'utf8');

  // Key stakeholders
  assert.match(content, /CityZone/);
  assert.match(content, /עתידים/);
  assert.match(content, /רוני/);
  assert.match(content, /יואב מילו/);

  // Technical advantages over loops and ultrasonic sensors
  assert.match(content, /חיישנים אולטרסוניים/);
  assert.match(content, /לולאות/);
  assert.match(content, /RTSP/);

  // Demo walkthrough & privacy
  assert.match(content, /demo\/atidim\.html/);
  assert.match(content, /No LPR/);
  assert.match(content, /לוחיות רישוי/);

  // 14-day zero-cost pilot terms
  assert.match(content, /14 יום/);
  assert.match(content, /0 ₪/);
});

test('the pitch doc quotes the peak window the chart actually draws', () => {
  const pitch = fs.readFileSync(pitchPath, 'utf8');
  const peaks = lot.getHourlyCurve().filter((p) => p.isPeak);
  const window = peaks[0].label + '–' + peaks[peaks.length - 1].label;
  assert.ok(
    pitch.includes(window) || pitch.includes(peaks[0].label + '-' + peaks[peaks.length - 1].label),
    'pitch doc must quote the peak window ' + window
  );
  // No fixed counter reading: the page shows the current hour, not 148 free.
  assert.doesNotMatch(pitch, /148 פנויים/);
  // The speaker says up front that the frame is a simulation.
  assert.match(pitch, /הדמיה/);
});

test('docs/launch/CITYZONE-ATIDIM.md is the meeting runbook for the demo page', () => {
  assert.ok(fs.existsSync(launchPath), 'launch runbook must exist');
  const content = fs.readFileSync(launchPath, 'utf8');
  assert.match(content, /demo\/atidim\.html/);
  assert.match(content, /CITYZONE_ATIDIM_PITCH\.md/);
  // The runbook walks the controls the page actually has.
  assert.match(content, /הדמה כניסת רכב/);
  assert.match(content, /זרימה אוטומטית/);
  assert.match(content, /אפס למצב השעה הנוכחית/);
  assert.match(content, /פרטיות/);
  assert.match(content, /#136/);
});
