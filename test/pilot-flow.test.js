// The spine of the unified pilot flow (#268): one bus, one settings shape, one
// path from a decoded camera frame to a driver alert with a hold.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FLOW = require('../src/lib/pilot-flow');
const LOT = require('../src/lib/atidim-lot');

const root = path.join(__dirname, '..');
const clip = JSON.parse(fs.readFileSync(path.join(root, 'pilot', 'sample-clip.json'), 'utf8'));

test('a cold start never alerts, and the occupancy comes from the lot model', () => {
  const flow = FLOW.createFlow({ lot: LOT });
  const frames = FLOW.expandClip(clip);
  const first = flow.ingest(frames[0], 1000);
  assert.deepEqual(first.freed, [], 'the first frame has nothing to diff against');
  assert.equal(flow.getAlert(), null);
  const direct = LOT.calculateOccupancy(frames[0].spots, LOT.ATIDIM_LOT.totalCapacity);
  assert.equal(first.summary.available, direct.available);
  assert.equal(first.summary.evTotal, 2);
});

test('a departure raises a spot-freed event and one driver alert with a hold', () => {
  const flow = FLOW.createFlow({ lot: LOT, settings: { holdSeconds: 120 } });
  const alerts = [];
  flow.bus.on(FLOW.EVENTS.ALERT, (a) => alerts.push(a));
  FLOW.expandClip(clip).forEach((frame, i) => flow.ingest(frame, i * 2000));
  assert.equal(flow.bus.history(FLOW.EVENTS.SPOT_FREED)[0].payload.spotId, 'A-09');
  assert.equal(alerts[0].headlineHe, 'התפנה תא חניה A-09');
  assert.match(alerts[0].bodyHe, /חיזוי, לא הבטחה/, 'the hold may not read as a promise');
  assert.equal(alerts[0].holdUntilMs - alerts[0].freedAtMs, 120000);
  assert.ok(alerts.some((a) => a.ev && /עמדת טעינה A-05/.test(a.headlineHe)));
});
