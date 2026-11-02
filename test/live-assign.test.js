const { test } = require('node:test');
const assert = require('node:assert/strict');
const liveAssign = require('../src/lib/live-assign');

test('live-assign: route distance respects directed one-way aisles and differs from euclidean', () => {
  const lotConfig = liveAssign.createDefaultLotConfig();
  assert.equal(lotConfig.spots.length, 36, 'default config has 36 spots across 3 aisles');

  // Aisle 1 goes EAST (x=100 to 700). Spot A4 is at x=264.
  const spotA4 = lotConfig.spots.find(s => s.id === 'A4');
  assert.ok(spotA4, 'spot A4 exists');

  // Driver 1 is at x=150 on Aisle 1, heading East (approaching spot A4)
  const driverApproaching = {
    x: 150,
    y: 120,
    aisleId: 'aisle-1',
    direction: 'E',
    speed: 5
  };

  const routeApproaching = liveAssign.calculateRouteToSpot(driverApproaching, spotA4, lotConfig);
  assert.equal(routeApproaching.isDirect, true, 'approaching driver on same aisle has direct route');
  assert.ok(routeApproaching.routeDistance < 150, 'direct route is short');
  assert.ok(routeApproaching.etaSeconds > 0 && routeApproaching.etaSeconds <= 30);
  assert.match(routeApproaching.turnInstruction, /פנה שמאלה/);

  // Driver 2 is at x=350 on Aisle 1, heading East (already PASSED spot A4 at x=264)
  const driverPassed = {
    x: 350,
    y: 120,
    aisleId: 'aisle-1',
    direction: 'E',
    speed: 5
  };

  const routePassed = liveAssign.calculateRouteToSpot(driverPassed, spotA4, lotConfig);
  assert.equal(routePassed.isDirect, false, 'driver that passed the spot cannot drive in reverse');
  // Euclidean distance is small (~86m), but route distance is much longer because the car must loop!
  const straightDist = liveAssign.euclideanDistance(driverPassed, { x: spotA4.accessX, y: spotA4.accessY });
  assert.ok(straightDist < 100, 'straight line distance is short');
  assert.ok(routePassed.routeDistance > straightDist * 5, 'directed route distance is much larger than euclidean distance');
  assert.match(routePassed.turnInstruction, /הקף חזרה/);
});

test('live-assign: assigns spot to the driver with minimal ETA (fastest arrival)', () => {
  const state = liveAssign.createAssignmentState();

  // Pick spot A2 at x=168 (near start of Aisle 1)
  const spotA2 = state.spots.find(s => s.id === 'A2');
  spotA2.status = 'free';

  // Driver 1 is at x=180 (passed A2!)
  // Driver 2 is at x=450 (passed A2!)
  // Set Driver 4 at x=120 on Aisle 1 (approaching A2 from behind at x=120, direct distance 48m!)
  state.drivers[0].x = 300; // Driver 1 passed
  state.drivers[3].x = 120; // Driver 4 approaching
  state.drivers[3].aisleId = 'aisle-1';
  state.drivers[3].direction = 'E';

  const assignment = liveAssign.assignSpot(state, 'A2');
  assert.ok(assignment, 'assignment created');
  assert.equal(assignment.spotId, 'A2');
  assert.equal(assignment.driverId, 'driver-4', 'driver 4 assigned because they are approaching with lowest ETA');
  assert.equal(assignment.status, 'pending_confirmation');
  assert.ok(assignment.etaSeconds <= 15, 'ETA is low for approaching driver');
});

test('live-assign: enforces 1-to-1 invariant (one spot = one driver)', () => {
  const state = liveAssign.createAssignmentState();
  const spotB3 = state.spots.find(s => s.id === 'B3');
  spotB3.status = 'free';

  const assignment1 = liveAssign.assignSpot(state, 'B3');
  assert.ok(assignment1, 'first assignment succeeds');
  const assignedDriverId = assignment1.driverId;

  // Attempting to assign the same spot again returns the existing active assignment
  const assignmentAgain = liveAssign.assignSpot(state, 'B3');
  assert.equal(assignmentAgain.driverId, assignedDriverId, 'cannot double-assign same spot');

  // Attempting to assign a second spot (C5) to the same driver fails
  const spotC5 = state.spots.find(s => s.id === 'C5');
  spotC5.status = 'free';

  const secondAssignment = liveAssign.assignSpot(state, 'C5', assignedDriverId);
  assert.equal(secondAssignment, null, 'driver already holding an active assignment cannot take a second spot');
});

test('live-assign: confirmation within 8 seconds commits the spot and updates metrics', () => {
  const state = liveAssign.createAssignmentState();
  const spotC1 = state.spots.find(s => s.id === 'C1');
  spotC1.status = 'free';

  const assignment = liveAssign.assignSpot(state, 'C1');
  assert.ok(assignment);

  const confirmed = liveAssign.confirmAssignment(state, 'C1');
  assert.equal(confirmed, true);

  const spot = state.spots.find(s => s.id === 'C1');
  assert.equal(spot.status, 'reserved');

  const driver = state.drivers.find(d => d.id === assignment.driverId);
  assert.equal(driver.status, 'navigating');

  const metrics = liveAssign.calculateMetrics(state);
  assert.equal(metrics.successfulAssignments, 1);
  assert.equal(metrics.successRate, 100);
});

test('live-assign: 8-second timeout transfers spot to the next fastest driver', () => {
  const state = liveAssign.createAssignmentState();
  const spotB5 = state.spots.find(s => s.id === 'B5');
  spotB5.status = 'free';

  const firstAssignment = liveAssign.assignSpot(state, 'B5');
  assert.ok(firstAssignment);
  const firstDriverId = firstAssignment.driverId;

  // Timeout triggers after 8 seconds of no confirmation
  const secondAssignment = liveAssign.handleTimeout(state, 'B5');
  assert.ok(secondAssignment, 'spot reassigned to next driver');
  assert.notEqual(secondAssignment.driverId, firstDriverId, 'second driver is different from first');
  assert.equal(secondAssignment.history.length, 2, 'history tracks both candidates');

  // First driver is back to searching
  const firstDriver = state.drivers.find(d => d.id === firstDriverId);
  assert.equal(firstDriver.status, 'searching');
  assert.equal(firstDriver.assignedSpotId, undefined);

  // Metrics reflect timeout
  const metrics = liveAssign.calculateMetrics(state);
  assert.equal(metrics.timedOutAssignments, 1);
});

test('live-assign: foreign car takeover detects intrusion and reroutes driver to alternative spot', () => {
  const state = liveAssign.createAssignmentState();
  const spotA6 = state.spots.find(s => s.id === 'A6');
  const spotA7 = state.spots.find(s => s.id === 'A7');
  spotA6.status = 'free';
  spotA7.status = 'free';

  const initialAssignment = liveAssign.assignSpot(state, 'A6');
  assert.ok(initialAssignment);
  const originalDriverId = initialAssignment.driverId;

  // Foreign car takes spot A6!
  const altAssignment = liveAssign.handleForeignCarTakeover(state, 'A6');
  assert.ok(altAssignment, 'alternative assignment generated');
  assert.equal(altAssignment.driverId, originalDriverId, 'same driver receives the alternative spot');
  assert.notEqual(altAssignment.spotId, 'A6', 'alternative spot is different from stolen spot');
  assert.equal(altAssignment.isAlternative, true);

  const stolenSpot = state.spots.find(s => s.id === 'A6');
  assert.equal(stolenSpot.status, 'occupied_foreign');

  const metrics = liveAssign.calculateMetrics(state);
  assert.equal(metrics.foreignCarTakeovers, 1);
});

test('live-assign: calculateMetrics computes honest statistics', () => {
  const state = liveAssign.createAssignmentState();
  state.metrics.totalAssignments = 10;
  state.metrics.successfulAssignments = 9;
  state.metrics.completedSearchTimes = [30, 40, 20];

  const metrics = liveAssign.calculateMetrics(state);
  assert.equal(metrics.successRate, 90, '9 out of 10 = 90%');
  assert.equal(metrics.averageSearchTimeSec, 30, 'average of 30, 40, 20 is 30');
});
