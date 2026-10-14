'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pitchPath = path.join(root, 'docs', 'CITYZONE_ATIDIM_PITCH.md');

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
