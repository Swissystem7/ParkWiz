const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const atidim = require('../src/lib/atidim');

const root = path.join(__dirname, '..');
const lotText = fs.readFileSync(path.join(root, atidim.LOT_FILE), 'utf8');
const lotJson = JSON.parse(lotText);

// ------------------------------------------------------------ parseLotSpots

test('the shipped Atidim lot parses with every bay accepted', () => {
  const lot = atidim.parseLotSpots(lotJson);
  assert.deepEqual(lot.skipped, []);
  assert.deepEqual(lot.errors, []);
  assert.equal(lot.capacity, 134);
  assert.equal(lot.spots.length, lot.capacity);
  assert.equal(lot.lotId, 'atidim');
  assert.equal(lot.source, 'synthetic');
  assert.deepEqual(lot.byZone, { A: 56, B: 64, C: 14 });
  assert.deepEqual(lot.byKind, { regular: 114, reserved: 16, ev: 2, accessible: 2 });
  assert.deepEqual(lot.image, { width: 1000, height: 700 });
});

test('the lot file is labeled synthetic in Hebrew and promises no live feed', () => {
  assert.match(lotJson.name, /עתידים/);
  assert.match(lotJson.note, /לא מדידה חיה/);
  for (const zone of lotJson.zones) assert.match(zone.label, /[֐-׿]/);
  const lot = atidim.parseLotSpots(lotJson);
  assert.equal(lot.spots.find((s) => s.kind === 'accessible').label, 'חנייה נגישה');
});

test('parsing the raw JSON text matches parsing the object', () => {
  assert.deepEqual(atidim.parseLotSpots(lotText), atidim.parseLotSpots(lotJson));
});

test('every parsed bay is a positive rect inside the frame, and rows do not overlap', () => {
  const { spots } = atidim.parseLotSpots(lotJson);
  for (const spot of spots) {
    assert.ok(spot.w > 0 && spot.h > 0, `${spot.id} has a positive size`);
    assert.ok(spot.x >= 0 && spot.y >= 0, `${spot.id} starts inside the frame`);
    assert.ok(spot.x + spot.w <= 1.0000001, `${spot.id} ends inside the frame`);
    assert.ok(spot.y + spot.h <= 1.0000001, `${spot.id} ends inside the frame`);
  }
  const overlaps = (a, b) =>
    a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 &&
    a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9;
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      if (spots[i].level !== spots[j].level) continue;
      assert.ok(!overlaps(spots[i], spots[j]), `${spots[i].id} overlaps ${spots[j].id}`);
    }
  }
});

test('source order is walking distance from the entrance and is never reordered', () => {
  const { spots } = atidim.parseLotSpots(lotJson);
  assert.equal(spots[0].id, 'A1-1');
  assert.equal(spots[0].order, 0);
  spots.forEach((spot, i) => assert.equal(spot.order, i));
});

test('a row expands to count bays spaced by w + gap', () => {
  const lot = atidim.parseLotSpots({
    spots: [{ idPrefix: 'R', count: 3, zone: 'A', x: 0.1, y: 0.2, w: 0.1, h: 0.3, axis: 'x', gap: 0.05 }],
  });
  assert.deepEqual(lot.spots.map((s) => s.id), ['R1', 'R2', 'R3']);
  assert.deepEqual(lot.spots.map((s) => +s.x.toFixed(4)), [0.1, 0.25, 0.4]);
  assert.deepEqual(lot.spots.map((s) => s.y), [0.2, 0.2, 0.2]);
});

test('a row on the y axis walks down instead of across', () => {
  const lot = atidim.parseLotSpots({
    spots: [{ idPrefix: 'Y', count: 2, x: 0.1, y: 0.1, w: 0.2, h: 0.3, axis: 'y', gap: 0.02 }],
  });
  assert.deepEqual(lot.spots.map((s) => +s.y.toFixed(4)), [0.1, 0.42]);
  assert.deepEqual(lot.spots.map((s) => s.x), [0.1, 0.1]);
});

test('a malformed bay is skipped with a reason, the rest of the lot survives', () => {
  const lot = atidim.parseLotSpots({
    spots: [
      { id: 'ok', x: 0.1, y: 0.1, w: 0.1, h: 0.1 },
      { id: 'no-rect', x: 'abc', y: 0.1, w: 0.1, h: 0.1 },
      { id: 'zero-width', x: 0.1, y: 0.1, w: 0, h: 0.1 },
      { id: 'off-frame', x: 0.95, y: 0.1, w: 0.2, h: 0.1 },
      { id: 'negative', x: -0.2, y: 0.1, w: 0.1, h: 0.1 },
      { id: '  ', x: 0.2, y: 0.1, w: 0.1, h: 0.1 },
      { id: 'typo-kind', kind: 'reserverd', x: 0.3, y: 0.1, w: 0.1, h: 0.1 },
      { id: 'half-level', level: 0.5, x: 0.4, y: 0.1, w: 0.1, h: 0.1 },
      null,
      { idPrefix: 'bad', count: 0, x: 0.1, y: 0.5, w: 0.1, h: 0.1 },
    ],
  });
  assert.deepEqual(lot.spots.map((s) => s.id), ['ok']);
  assert.equal(lot.capacity, 1);
  assert.deepEqual(lot.skipped.map((s) => s.reason), [
    'bad-rect', 'bad-rect', 'out-of-frame', 'out-of-frame', 'missing-id',
    'unknown-kind', 'bad-level', 'not-an-object', 'bad-count',
  ]);
});

test('a duplicate id is dropped so occupancy state cannot collide', () => {
  const lot = atidim.parseLotSpots({
    spots: [
      { id: 'dup', x: 0.1, y: 0.1, w: 0.1, h: 0.1 },
      { id: 'dup', x: 0.3, y: 0.1, w: 0.1, h: 0.1 },
    ],
  });
  assert.equal(lot.capacity, 1);
  assert.deepEqual(lot.skipped, [{ index: 1, id: 'dup', reason: 'duplicate-id' }]);
});

test('a bay with no kind is a plain bay, not a skipped one', () => {
  const lot = atidim.parseLotSpots({ spots: [{ id: 'a', x: 0, y: 0, w: 0.5, h: 0.5 }] });
  assert.equal(lot.spots[0].kind, 'regular');
  assert.equal(lot.spots[0].level, 0);
  assert.equal(lot.spots[0].zone, '');
});

test('a root that is not a lot returns an empty lot with an error, never null', () => {
  for (const [input, error] of [
    [null, 'not-a-lot-object'],
    [42, 'not-a-lot-object'],
    [[], 'not-a-lot-object'],
    ['{nope', 'unparseable-json'],
    [{ name: 'x' }, 'no-spots-array'],
    [{ spots: 'A1' }, 'no-spots-array'],
  ]) {
    const lot = atidim.parseLotSpots(input);
    assert.deepEqual(lot.errors, [error]);
    assert.equal(lot.capacity, 0);
    assert.deepEqual(lot.spots, []);
  }
});

// ------------------------------------------------------------ getHourlyCurve

test('the curve has one row per local hour', () => {
  const curve = atidim.getHourlyCurve({ day: 1 });
  assert.equal(curve.length, 24);
  curve.forEach((row, hour) => {
    assert.equal(row.hour, hour);
    assert.ok(row.occupancy >= 0 && row.occupancy <= 1, `hour ${hour} is a fraction`);
  });
});

test('08:00-17:00 is the peak window: every peak hour beats every off-peak hour', () => {
  const curve = atidim.getHourlyCurve({ day: 2 });
  const peak = curve.filter((row) => row.peak);
  const offPeak = curve.filter((row) => !row.peak);
  assert.deepEqual(peak.map((row) => row.hour), [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
  assert.equal(atidim.PEAK_START_HOUR, 8);
  assert.equal(atidim.PEAK_END_HOUR, 17);
  const quietestPeak = Math.min(...peak.map((row) => row.occupancy));
  const busiestOffPeak = Math.max(...offPeak.map((row) => row.occupancy));
  assert.ok(quietestPeak > busiestOffPeak, `${quietestPeak} > ${busiestOffPeak}`);
});

test('the busiest hour of every day sits inside the peak window', () => {
  for (let day = 0; day <= 6; day++) {
    const curve = atidim.getHourlyCurve({ day });
    const busiest = curve.reduce((a, b) => (b.occupancy > a.occupancy ? b : a));
    assert.ok(busiest.peak, `day ${day} peaks at ${busiest.hour}:00`);
  }
});

test('the morning ramp rises and the evening drains', () => {
  const curve = atidim.getHourlyCurve({ day: 1 }).map((row) => row.occupancy);
  for (let hour = 6; hour <= 9; hour++) {
    assert.ok(curve[hour] > curve[hour - 1], `${hour}:00 is busier than ${hour - 1}:00`);
  }
  for (let hour = 18; hour <= 23; hour++) {
    assert.ok(curve[hour] < curve[hour - 1], `${hour}:00 is quieter than ${hour - 1}:00`);
  }
  assert.ok(curve[3] < 0.1, 'the lot is nearly empty at 03:00');
});

test('Friday empties by early afternoon and Saturday never fills', () => {
  const friday = atidim.getHourlyCurve({ day: 5 }).map((row) => row.occupancy);
  const saturday = atidim.getHourlyCurve({ day: 6 }).map((row) => row.occupancy);
  const workday = atidim.getHourlyCurve({ day: 2 }).map((row) => row.occupancy);
  assert.ok(friday[10] > friday[16] * 3, 'Friday morning is the Friday peak');
  assert.ok(friday[10] < workday[10] / 2, 'Friday never reaches a workday level');
  assert.ok(Math.max(...saturday) < 0.1, 'Saturday stays under a tenth of the lot');
});

test('Sunday and Thursday are softer than mid-week, same shape', () => {
  const hour = 10;
  const at = (day) => atidim.getHourlyCurve({ day })[hour].occupancy;
  assert.ok(at(4) < at(0), 'Thursday is quieter than Sunday');
  assert.ok(at(0) < at(2), 'Sunday is quieter than Tuesday');
  assert.equal(at(1), at(2));
});

test('occupied is a bay count with a capacity and null without one', () => {
  const withCapacity = atidim.getHourlyCurve({ day: 1, capacity: 134 });
  assert.equal(withCapacity[10].occupied, Math.round(withCapacity[10].occupancy * 134));
  assert.ok(withCapacity[10].occupied > 120);
  for (const bad of [undefined, 0, -5, 'many', 12.5, null]) {
    const curve = atidim.getHourlyCurve({ day: 1, capacity: bad });
    assert.equal(curve[10].occupied, null, `capacity ${String(bad)} reads as unknown, not zero`);
  }
});

test('a missing or nonsense day falls back to a workday instead of NaN', () => {
  const workday = atidim.getHourlyCurve({ day: 1 });
  for (const bad of [undefined, null, 'Monday', 9, -1, 1.5, NaN]) {
    assert.deepEqual(atidim.getHourlyCurve({ day: bad }), workday);
  }
  assert.deepEqual(atidim.getHourlyCurve(), workday);
  assert.deepEqual(atidim.getHourlyCurve(null), workday);
});

test('minutes interpolate across the 07:00-08:00 ramp instead of jumping', () => {
  const at = (hour, minute) => atidim.getTargetOccupancy({ day: 1, hour, minute });
  assert.equal(at(7, 0), atidim.getHourlyCurve({ day: 1 })[7].occupancy);
  assert.ok(at(7, 15) > at(7, 0));
  assert.ok(at(7, 30) > at(7, 15));
  assert.ok(at(7, 45) < at(8, 0));
  assert.equal(at(7, 30), 0.6); // halfway between 0.42 and 0.78
});

test('an out-of-range hour wraps instead of reading undefined', () => {
  const at = (hour) => atidim.getTargetOccupancy({ day: 1, hour });
  assert.equal(at(24), at(0));
  assert.equal(at(25), at(1));
  assert.equal(at(-1), at(23));
  assert.equal(at('ten'), at(0));
  assert.ok(Number.isFinite(at(undefined)));
});

// ----------------------------------------------------- simulateOccupancyStep

const lot = atidim.parseLotSpots(lotJson);
const stepAt = (hour, extra) =>
  atidim.simulateOccupancyStep(null, Object.assign({ spots: lot, day: 1, hour }, extra || {}));

test('a step lands exactly on the curve target for that moment', () => {
  for (let hour = 0; hour < 24; hour++) {
    const result = stepAt(hour);
    assert.equal(result.occupied, result.targetOccupied, `hour ${hour}`);
    assert.equal(result.occupied + result.free, lot.capacity);
    assert.equal(result.targetOccupied, Math.round(result.target * lot.capacity));
  }
});

test('the same seed replays the same day, bay for bay', () => {
  const run = (seed) => {
    let state = null;
    const frames = [];
    for (let i = 0; i < 96; i++) {
      state = atidim.simulateOccupancyStep(state, { spots: lot, day: 1, seed });
      frames.push({ hour: state.hour, minute: state.minute, occupied: state.occupied, arrived: state.arrived });
    }
    return frames;
  };
  assert.deepEqual(run(7), run(7));
  assert.notDeepEqual(run(7), run(8));
});

test('the module never calls Math.random — a replayable demo is the point', () => {
  const src = fs.readFileSync(path.join(root, 'src', 'lib', 'atidim.js'), 'utf8');
  assert.doesNotMatch(src, /Math\s*\.\s*random\s*\(/);
});

test('a day of 15-minute ticks walks the clock and tracks the curve', () => {
  let state = null;
  const byHour = new Map();
  for (let i = 0; i < 96; i++) {
    state = atidim.simulateOccupancyStep(state, { spots: lot, day: 1, seed: 3 });
    if (state.minute === 0) byHour.set(state.hour, state.occupied);
  }
  assert.equal(state.hour, 23);
  assert.equal(state.minute, 45);
  assert.equal(state.step, 95);
  assert.equal(state.day, 1);
  const curve = atidim.getHourlyCurve({ day: 1, capacity: lot.capacity });
  for (const [hour, occupied] of byHour) {
    assert.equal(occupied, curve[hour].occupied, `${hour}:00`);
  }
});

test('ticking past midnight rolls the weekday forward', () => {
  let state = atidim.simulateOccupancyStep(null, { spots: lot, day: 4, hour: 23, minute: 30 });
  state = atidim.simulateOccupancyStep(state, { spots: lot });
  assert.equal(state.hour, 23);
  assert.equal(state.minute, 45);
  assert.equal(state.day, 4);
  state = atidim.simulateOccupancyStep(state, { spots: lot });
  assert.equal(state.hour, 0);
  assert.equal(state.minute, 0);
  assert.equal(state.day, 5, 'Thursday night becomes Friday');
});

test('an explicit minute stays in the hour the lot is already in', () => {
  const first = stepAt(9);
  const sameHour = atidim.simulateOccupancyStep(first, { spots: lot, minute: 30 });
  assert.equal(sameHour.hour, 9);
  assert.equal(sameHour.minute, 30);
  assert.equal(sameHour.day, 1);
});

test('a cold start fills to the target rather than showing an empty lot', () => {
  const nine = stepAt(9);
  assert.ok(nine.occupancy > 0.85, `09:00 cold start is busy, got ${nine.occupancy}`);
  assert.equal(nine.departed.length, 0);
  assert.equal(nine.arrived.length, nine.occupied);
  assert.equal(nine.step, 0);
});

test('the morning ramp arrives and the evening departs', () => {
  const morning = atidim.simulateOccupancyStep(stepAt(7), { spots: lot, day: 1, hour: 8 });
  assert.ok(morning.arrived.length > morning.departed.length);
  assert.ok(morning.occupied > stepAt(7).occupied);

  const evening = atidim.simulateOccupancyStep(stepAt(17), { spots: lot, day: 1, hour: 19 });
  assert.ok(evening.departed.length > evening.arrived.length);
  assert.ok(evening.occupied < stepAt(17).occupied);
});

test('bays change hands at a flat target: churn moves cars, not the count', () => {
  const first = stepAt(11);
  const second = atidim.simulateOccupancyStep(first, { spots: lot, day: 1, hour: 11, minute: 0 });
  assert.equal(second.occupied, first.occupied, 'the car count holds at the curve');
  assert.ok(second.departed.length > 0, 'somebody still leaves');
  assert.equal(second.arrived.length, second.departed.length);
  assert.notDeepEqual(
    second.states.map((s) => s.occupied),
    first.states.map((s) => s.occupied),
  );
  for (const id of second.departed) {
    assert.ok(!second.arrived.includes(id), `${id} is not vacated and retaken in one tick`);
  }
});

test('churn: 0 freezes the lot when the target has not moved', () => {
  const first = stepAt(11, { churn: 0 });
  const second = atidim.simulateOccupancyStep(first, { spots: lot, day: 1, hour: 11, minute: 0, churn: 0 });
  assert.deepEqual(second.arrived, []);
  assert.deepEqual(second.departed, []);
  assert.deepEqual(second.states, first.states);
});

test('off-peak turnover is lower than peak turnover', () => {
  const churnAt = (hour) => {
    const first = stepAt(hour);
    const next = atidim.simulateOccupancyStep(first, { spots: lot, day: 1, hour, minute: 0 });
    return next.departed.length;
  };
  assert.ok(churnAt(11) > churnAt(2), 'the lot turns over faster during work hours');
});

test('general bays fill before permit-only bays, and empty out first', () => {
  const quiet = stepAt(6);
  const permitIds = new Set(lot.spots.filter((s) => s.kind !== 'regular' && s.kind !== 'reserved').map((s) => s.id));
  const takenPermit = quiet.states.filter((s) => s.occupied && permitIds.has(s.id));
  assert.deepEqual(takenPermit, [], 'an accessible/EV bay is not taken while the lot is near empty');

  const full = stepAt(11);
  assert.ok(full.occupied > lot.capacity * 0.9);
  const freeAtPeak = full.states.filter((s) => !s.occupied).map((s) => s.id);
  assert.ok(freeAtPeak.some((id) => permitIds.has(id)), 'permit-only bays are the last ones left');
});

test('a bay near the entrance is taken before the far end of the lot', () => {
  const states = stepAt(7).states;
  const occupiedOrders = states
    .map((s, i) => ({ occupied: s.occupied, order: i }))
    .filter((s) => s.occupied)
    .map((s) => s.order);
  const median = occupiedOrders[Math.floor(occupiedOrders.length / 2)];
  assert.ok(median < lot.capacity / 2, 'the first rows carry the early arrivals');
});

test('a bare bay list works without a parsed lot, in list order', () => {
  const spots = [
    { id: 'near', x: 0, y: 0, w: 0.2, h: 0.2 },
    { id: 'far', x: 0.3, y: 0, w: 0.2, h: 0.2 },
  ];
  const result = atidim.simulateOccupancyStep(null, { spots, day: 1, hour: 6 });
  assert.equal(result.capacity, 2);
  assert.equal(result.occupied, 0, '0.15 of two bays rounds to none');
  const busy = atidim.simulateOccupancyStep(null, { spots, day: 1, hour: 7 });
  assert.deepEqual(busy.arrived, ['near']);
});

test('state can be handed back as a bare states array', () => {
  const first = stepAt(8);
  const fromArray = atidim.simulateOccupancyStep(first.states, { spots: lot, day: 1, hour: 9 });
  const fromResult = atidim.simulateOccupancyStep(first, { spots: lot, day: 1, hour: 9 });
  assert.equal(fromArray.occupied, fromResult.occupied);
});

test('an unknown bay in a stale state is ignored, not resurrected', () => {
  const stale = [{ id: 'gone', occupied: true, sinceStep: 0 }, { id: 'A1-1', occupied: true, sinceStep: 0 }];
  const result = atidim.simulateOccupancyStep(stale, { spots: lot, day: 1, hour: 3 });
  assert.equal(result.states.length, lot.capacity);
  assert.ok(!result.states.some((s) => s.id === 'gone'));
  assert.equal(result.occupied, result.targetOccupied);
});

test('an empty lot reports unknown occupancy, not a confident 0%', () => {
  const result = atidim.simulateOccupancyStep(null, { spots: [], day: 1, hour: 10 });
  assert.equal(result.capacity, 0);
  assert.equal(result.occupancy, null);
  assert.deepEqual(result.states, []);
  assert.ok(result.target > 0, 'the curve itself still has a value');
});

test('the longest-parked car leaves before one that just arrived', () => {
  const spots = lot.spots.slice(0, 4);
  const states = [
    { id: spots[0].id, occupied: true, sinceStep: 0 },
    { id: spots[1].id, occupied: true, sinceStep: 90 },
    { id: spots[2].id, occupied: true, sinceStep: 95 },
    { id: spots[3].id, occupied: false, sinceStep: 95 },
  ];
  const result = atidim.simulateOccupancyStep(states, {
    spots, day: 1, hour: 19, step: 96, churn: 0,
  });
  assert.equal(result.occupied, 1);
  assert.deepEqual(result.departed, [spots[0].id, spots[1].id]);
});

test('a stored state survives a round trip through JSON', () => {
  const first = stepAt(9, { seed: 11 });
  const revived = JSON.parse(JSON.stringify(first));
  const fromRevived = atidim.simulateOccupancyStep(revived, { spots: lot });
  const fromLive = atidim.simulateOccupancyStep(first, { spots: lot });
  assert.deepEqual(fromRevived, fromLive);
});
