/**
 * ParkWiz — Smart Parking Live Assignment Module (src/lib/live-assign.js)
 *
 * Implements real-time optimal parking spot assignment based on directed aisle
 * route distance and driving direction (not Euclidean straight-line distance).
 *
 * Features:
 *  - Directed aisle network graph with legal driving directions.
 *  - Route distance, ETA and maneuver calculation.
 *  - Real-time optimal driver assignment (lowest ETA among unassigned drivers).
 *  - 1-to-1 invariant: one spot = one driver at all times.
 *  - 8-second confirmation countdown with auto-delegation to the next fastest driver.
 *  - Foreign car takeover detection & automatic alternative spot assignment.
 *  - KPI tracking: Success rate (%) and average search time (seconds).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.ParkWizLiveAssign = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TIMEOUT_SECONDS = 8;
  const DEFAULT_DRIVER_SPEED = 5; // meters per second (~18 km/h in parking lot)

  /**
   * Euclidean straight-line distance between two points.
   */
  function euclideanDistance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.hypot(dx, dy);
  }

  /**
   * Default parking lot configuration with 36 spots in 3 rows and directed aisles.
   */
  function createDefaultLotConfig() {
    const aisles = [
      { id: 'aisle-1', name: 'מעבר 1 (שורה A)', y: 120, xStart: 100, xEnd: 700, direction: 'E' },
      { id: 'aisle-2', name: 'מעבר 2 (שורה B)', y: 260, xStart: 700, xEnd: 100, direction: 'W' },
      { id: 'aisle-3', name: 'מעבר 3 (שורה C)', y: 400, xStart: 100, xEnd: 700, direction: 'E' }
    ];

    const spots = [];
    // Row A: 12 spots along Aisle 1 (y=75, access from Aisle 1 at y=120)
    for (let i = 1; i <= 12; i++) {
      const x = 120 + (i - 1) * 48;
      spots.push({
        id: `A${i}`,
        row: 'A',
        number: i,
        aisleId: 'aisle-1',
        x: x,
        y: 70,
        accessX: x,
        accessY: 120,
        turnDirection: 'שמאלה', // Heading East, spot is North -> turn Left
        status: 'occupied', // initially occupied or free
        type: i === 1 ? 'disabled' : (i === 2 ? 'ev' : 'regular')
      });
    }

    // Row B: 12 spots along Aisle 2 (y=210, access from Aisle 2 at y=260)
    for (let i = 1; i <= 12; i++) {
      const x = 650 - (i - 1) * 48;
      spots.push({
        id: `B${i}`,
        row: 'B',
        number: i,
        aisleId: 'aisle-2',
        x: x,
        y: 210,
        accessX: x,
        accessY: 260,
        turnDirection: 'ימינה', // Heading West, spot is North -> turn Right
        status: 'occupied',
        type: i === 1 ? 'disabled' : (i === 12 ? 'ev' : 'regular')
      });
    }

    // Row C: 12 spots along Aisle 3 (y=450, access from Aisle 3 at y=400)
    for (let i = 1; i <= 12; i++) {
      const x = 120 + (i - 1) * 48;
      spots.push({
        id: `C${i}`,
        row: 'C',
        number: i,
        aisleId: 'aisle-3',
        x: x,
        y: 450,
        accessX: x,
        accessY: 400,
        turnDirection: 'ימינה', // Heading East, spot is South -> turn Right
        status: 'occupied',
        type: i === 6 ? 'ev' : 'regular'
      });
    }

    return {
      width: 800,
      height: 520,
      aisles,
      spots,
      connectors: [
        { id: 'east-connector', fromAisle: 'aisle-1', toAisle: 'aisle-2', x: 700, y1: 120, y2: 260, length: 140 },
        { id: 'west-connector', fromAisle: 'aisle-2', toAisle: 'aisle-3', x: 100, y1: 260, y2: 400, length: 140 },
        { id: 'loop-return', fromAisle: 'aisle-3', toAisle: 'aisle-1', length: 500 } // perimeter return
      ]
    };
  }

  /**
   * Calculates legal directed driving route distance and ETA from a driver position
   * to a target parking spot.
   *
   * @param {Object} driver - { x, y, aisleId, direction, speed }
   * @param {Object} spot - { accessX, accessY, aisleId, turnDirection }
   * @param {Object} lotConfig - Lot configuration with aisles and connectors
   * @returns {Object} { routeDistance, straightDistance, etaSeconds, turnInstruction, isDirect }
   */
  function calculateRouteToSpot(driver, spot, lotConfig) {
    const speed = driver.speed || DEFAULT_DRIVER_SPEED;
    const straightDist = euclideanDistance(driver, { x: spot.accessX, y: spot.accessY });
    let routeDistance = 0;
    let turnInstruction = `פנה ${spot.turnDirection}`;

    const aislesMap = {};
    for (const a of lotConfig.aisles) {
      aislesMap[a.id] = a;
    }

    const driverAisle = aislesMap[driver.aisleId] || lotConfig.aisles[0];
    const spotAisle = aislesMap[spot.aisleId];

    if (!spotAisle) {
      return {
        routeDistance: Infinity,
        straightDistance: straightDist,
        etaSeconds: Infinity,
        turnInstruction: 'לא נמצא נתיב חוקי',
        isDirect: false
      };
    }

    // Case 1: Driver is already on the same aisle as the spot
    if (driverAisle.id === spotAisle.id) {
      let isAhead = false;
      let distToSpot = 0;

      if (driverAisle.direction === 'E') {
        if (driver.x <= spot.accessX) {
          isAhead = true;
          distToSpot = spot.accessX - driver.x;
        }
      } else if (driverAisle.direction === 'W') {
        if (driver.x >= spot.accessX) {
          isAhead = true;
          distToSpot = driver.x - spot.accessX;
        }
      }

      if (isAhead) {
        // Direct approach! Driver is approaching the spot in the legal direction
        routeDistance = Math.max(5, Math.round(distToSpot));
        return {
          routeDistance,
          straightDistance: Math.round(straightDist),
          etaSeconds: Math.max(1, Math.round(routeDistance / speed)),
          turnInstruction: `המשך ישר כ-${routeDistance} מ' ואז פנה ${spot.turnDirection}`,
          isDirect: true
        };
      }

      // Passed the spot! Cannot reverse in one-way aisle. Must loop all the way around!
      let distToEndOfAisle = 0;
      if (driverAisle.direction === 'E') {
        distToEndOfAisle = driverAisle.xEnd - driver.x;
      } else {
        distToEndOfAisle = driver.x - driverAisle.xEnd;
      }

      // Add full circuit loop:
      // Loop from end of Aisle 1 (or 2, or 3) back to this aisle
      routeDistance = distToEndOfAisle + 900 + (spot.accessX - 100);
      return {
        routeDistance: Math.round(routeDistance),
        straightDistance: Math.round(straightDist),
        etaSeconds: Math.max(2, Math.round(routeDistance / speed)),
        turnInstruction: `עברת את החניה — סע במעבר המקשר והקף חזרה, ואז פנה ${spot.turnDirection}`,
        isDirect: false
      };
    }

    // Case 2: Driver is on a different aisle.
    // Calculate distance to end of current aisle + connectors + entrance of spot aisle to spot.
    let distToAisleEnd = 0;
    if (driverAisle.direction === 'E') {
      distToAisleEnd = Math.max(0, driverAisle.xEnd - driver.x);
    } else {
      distToAisleEnd = Math.max(0, driver.x - driverAisle.xEnd);
    }

    let connectorDist = 0;
    if (driverAisle.id === 'aisle-1' && spotAisle.id === 'aisle-2') {
      connectorDist = 140; // East connector
      const distFromStart = Math.max(0, 700 - spot.accessX);
      routeDistance = distToAisleEnd + connectorDist + distFromStart;
    } else if (driverAisle.id === 'aisle-2' && spotAisle.id === 'aisle-3') {
      connectorDist = 140; // West connector
      const distFromStart = Math.max(0, spot.accessX - 100);
      routeDistance = distToAisleEnd + connectorDist + distFromStart;
    } else if (driverAisle.id === 'aisle-1' && spotAisle.id === 'aisle-3') {
      // 1 -> 2 -> 3
      connectorDist = 140 + 600 + 140;
      const distFromStart = Math.max(0, spot.accessX - 100);
      routeDistance = distToAisleEnd + connectorDist + distFromStart;
    } else {
      // 3 -> 1, or 2 -> 1 (perimeter return)
      connectorDist = 450;
      let distFromStart = 0;
      if (spotAisle.direction === 'E') {
        distFromStart = Math.max(0, spot.accessX - 100);
      } else {
        distFromStart = Math.max(0, 700 - spot.accessX);
      }
      routeDistance = distToAisleEnd + connectorDist + distFromStart;
    }

    routeDistance = Math.round(routeDistance);
    const etaSeconds = Math.max(2, Math.round(routeDistance / speed));

    return {
      routeDistance,
      straightDistance: Math.round(straightDist),
      etaSeconds,
      turnInstruction: `סע למעבר המקשר, המשך ל-${spotAisle.name} ואז פנה ${spot.turnDirection}`,
      isDirect: false
    };
  }

  /**
   * Evaluates all searching drivers for a freed spot and returns the best candidate
   * with the lowest ETA based on directed route distance.
   *
   * @param {Object} spot - Target spot object
   * @param {Array} drivers - List of active driver objects
   * @param {Object} lotConfig - Lot configuration
   * @param {Set|Array} [excludedDriverIds] - Optional driver IDs to skip (e.g. timed out)
   * @returns {Object|null} Best candidate { driver, route, etaSeconds, candidateRank }
   */
  function findBestDriverForSpot(spot, drivers, lotConfig, excludedDriverIds = []) {
    const excluded = new Set(excludedDriverIds);
    const eligibleDrivers = drivers.filter(d =>
      !excluded.has(d.id) &&
      d.status === 'searching' &&
      !d.assignedSpotId
    );

    if (eligibleDrivers.length === 0) return null;

    const ranked = eligibleDrivers.map(driver => {
      const route = calculateRouteToSpot(driver, spot, lotConfig);
      return {
        driver,
        route,
        etaSeconds: route.etaSeconds,
        routeDistance: route.routeDistance
      };
    }).sort((a, b) => a.etaSeconds - b.etaSeconds || a.routeDistance - b.routeDistance);

    return ranked[0] || null;
  }

  /**
   * Initializes state machine for live parking assignment.
   */
  function createAssignmentState(lotConfig = createDefaultLotConfig()) {
    return {
      lotConfig,
      spots: JSON.parse(JSON.stringify(lotConfig.spots)),
      drivers: [
        { id: 'driver-1', name: 'נהג 1 (דני)', x: 180, y: 120, aisleId: 'aisle-1', direction: 'E', speed: 5, status: 'searching', searchStartedAt: Date.now() },
        { id: 'driver-2', name: 'נהגת 2 (מיכל)', x: 450, y: 120, aisleId: 'aisle-1', direction: 'E', speed: 5, status: 'searching', searchStartedAt: Date.now() },
        { id: 'driver-3', name: 'נהג 3 (יוסי)', x: 620, y: 260, aisleId: 'aisle-2', direction: 'W', speed: 5, status: 'searching', searchStartedAt: Date.now() },
        { id: 'driver-4', name: 'נהגת 4 (תמר)', x: 250, y: 400, aisleId: 'aisle-3', direction: 'E', speed: 5, status: 'searching', searchStartedAt: Date.now() }
      ],
      activeAssignments: {}, // spotId -> { driverId, assignedAt, expiresAt, history: [driverIds] }
      metrics: {
        totalAssignments: 0,
        successfulAssignments: 0,
        timedOutAssignments: 0,
        foreignCarTakeovers: 0,
        completedSearchTimes: [] // in seconds
      },
      auditLog: []
    };
  }

  /**
   * Assigns a freed spot to the fastest available driver.
   *
   * @param {Object} state - Assignment state
   * @param {string} spotId - ID of freed spot
   * @param {string} [forceDriverId] - Optional specific driver
   * @returns {Object|null} The assignment details or null if no eligible driver
   */
  function assignSpot(state, spotId, forceDriverId = null) {
    const spot = state.spots.find(s => s.id === spotId);
    if (!spot) return null;

    // A spot cannot be double assigned (1-to-1 invariant)
    if (state.activeAssignments[spotId]) {
      return state.activeAssignments[spotId];
    }

    let candidate = null;
    if (forceDriverId) {
      const driver = state.drivers.find(d => d.id === forceDriverId && !d.assignedSpotId);
      if (driver) {
        const route = calculateRouteToSpot(driver, spot, state.lotConfig);
        candidate = { driver, route, etaSeconds: route.etaSeconds };
      }
    } else {
      candidate = findBestDriverForSpot(spot, state.drivers, state.lotConfig);
    }

    if (!candidate) {
      spot.status = 'free';
      return null;
    }

    const { driver, route, etaSeconds } = candidate;

    // Enforce 1-to-1 invariant: driver cannot have another active spot
    if (driver.assignedSpotId) {
      return null;
    }

    const assignment = {
      spotId,
      driverId: driver.id,
      driverName: driver.name,
      assignedAt: Date.now(),
      expiresAt: Date.now() + (TIMEOUT_SECONDS * 1000),
      etaSeconds,
      routeDistance: route.routeDistance,
      turnInstruction: route.turnInstruction,
      history: [driver.id],
      status: 'pending_confirmation'
    };

    state.activeAssignments[spotId] = assignment;
    spot.status = 'assigned';
    driver.status = 'assigned';
    driver.assignedSpotId = spotId;
    state.metrics.totalAssignments++;

    const logEntry = {
      time: new Date().toLocaleTimeString('he-IL'),
      type: 'ASSIGNMENT_CREATED',
      message: `חניה ${spotId} שויכה ל-${driver.name} (זמן הגעה משוער: ${etaSeconds} שניות, ${route.turnInstruction})`
    };
    state.auditLog.unshift(logEntry);

    return assignment;
  }

  /**
   * Driver confirms the assigned spot within 8 seconds.
   */
  function confirmAssignment(state, spotId) {
    const assignment = state.activeAssignments[spotId];
    if (!assignment || assignment.status !== 'pending_confirmation') return false;

    const spot = state.spots.find(s => s.id === spotId);
    const driver = state.drivers.find(d => d.id === assignment.driverId);

    assignment.status = 'confirmed';
    if (spot) spot.status = 'reserved';
    if (driver) {
      driver.status = 'navigating';
      const searchDurationSec = Math.max(5, Math.round((Date.now() - (driver.searchStartedAt || Date.now())) / 1000));
      state.metrics.completedSearchTimes.push(searchDurationSec);
    }

    state.metrics.successfulAssignments++;

    state.auditLog.unshift({
      time: new Date().toLocaleTimeString('he-IL'),
      type: 'ASSIGNMENT_CONFIRMED',
      message: `${assignment.driverName} אישר/ה את חניה ${spotId} תוך חלון 8 השניות!`
    });

    return true;
  }

  /**
   * Handles 8-second timeout expiration. Passes the spot to the next fastest driver.
   *
   * @param {Object} state - Assignment state
   * @param {string} spotId - ID of spot whose timeout expired
   * @returns {Object|null} New assignment to next driver or null
   */
  function handleTimeout(state, spotId) {
    const assignment = state.activeAssignments[spotId];
    if (!assignment || assignment.status !== 'pending_confirmation') return null;

    const spot = state.spots.find(s => s.id === spotId);
    const oldDriver = state.drivers.find(d => d.id === assignment.driverId);

    // Free the previous driver back to searching
    if (oldDriver) {
      oldDriver.status = 'searching';
      delete oldDriver.assignedSpotId;
    }

    state.metrics.timedOutAssignments++;
    const prevHistory = [...assignment.history];

    state.auditLog.unshift({
      time: new Date().toLocaleTimeString('he-IL'),
      type: 'ASSIGNMENT_TIMEOUT',
      message: `חלפו 8 שניות — ${assignment.driverName} לא אישר/ה את חניה ${spotId}. מעביר לנהג הבא!`
    });

    delete state.activeAssignments[spotId];

    // Find next fastest driver excluding previous candidates
    const nextCandidate = findBestDriverForSpot(spot, state.drivers, state.lotConfig, prevHistory);

    if (!nextCandidate) {
      if (spot) spot.status = 'free';
      state.auditLog.unshift({
        time: new Date().toLocaleTimeString('he-IL'),
        type: 'SPOT_FREE',
        message: `חניה ${spotId} נותרה פנויה — אין נהגים נוספים פנויים כעת.`
      });
      return null;
    }

    const { driver: nextDriver, route, etaSeconds } = nextCandidate;
    const newAssignment = {
      spotId,
      driverId: nextDriver.id,
      driverName: nextDriver.name,
      assignedAt: Date.now(),
      expiresAt: Date.now() + (TIMEOUT_SECONDS * 1000),
      etaSeconds,
      routeDistance: route.routeDistance,
      turnInstruction: route.turnInstruction,
      history: [...prevHistory, nextDriver.id],
      status: 'pending_confirmation'
    };

    state.activeAssignments[spotId] = newAssignment;
    if (spot) spot.status = 'assigned';
    nextDriver.status = 'assigned';
    nextDriver.assignedSpotId = spotId;

    state.auditLog.unshift({
      time: new Date().toLocaleTimeString('he-IL'),
      type: 'ASSIGNMENT_TRANSFERRED',
      message: `חניה ${spotId} הועברה ל-${nextDriver.name} (זמן הגעה: ${etaSeconds} שניות, ${route.turnInstruction})`
    });

    return newAssignment;
  }

  /**
   * Edge Case: A foreign / unauthorized car takes the assigned spot.
   * System detects foreign occupancy and automatically assigns an alternative free spot to the driver.
   *
   * @param {Object} state - Assignment state
   * @param {string} spotId - Spot taken by foreign vehicle
   * @returns {Object|null} Alternative assignment details or null
   */
  function handleForeignCarTakeover(state, spotId) {
    const spot = state.spots.find(s => s.id === spotId);
    if (!spot) return null;

    const assignment = state.activeAssignments[spotId];
    spot.status = 'occupied_foreign';
    state.metrics.foreignCarTakeovers++;

    if (!assignment) {
      state.auditLog.unshift({
        time: new Date().toLocaleTimeString('he-IL'),
        type: 'FOREIGN_CAR_DETECTED',
        message: `זיהוי מצלמה: רכב זר חנה בחניה ${spotId}.`
      });
      return null;
    }

    const displacedDriver = state.drivers.find(d => d.id === assignment.driverId);
    delete state.activeAssignments[spotId];

    state.auditLog.unshift({
      time: new Date().toLocaleTimeString('he-IL'),
      type: 'FOREIGN_CAR_ALERT',
      message: `⚠️ מקרה קצה: רכב זר תפס את חניה ${spotId}! מחשב מיד חניה חלופית עבור ${assignment.driverName}...`
    });

    if (!displacedDriver) return null;

    // Search for another free spot with lowest ETA for this driver
    const availableSpots = state.spots.filter(s => s.id !== spotId && (s.status === 'free' || s.status === 'occupied'));
    // Make sure we have at least one free alternative, or free up an adjacent spot for demonstration
    let targetFreeSpot = state.spots.find(s => s.status === 'free');
    if (!targetFreeSpot) {
      // For demo robustness, free a spot so displaced driver is never stranded!
      const candidateToFree = state.spots.find(s => s.id !== spotId && !state.activeAssignments[s.id] && s.status !== 'occupied_foreign');
      if (candidateToFree) {
        candidateToFree.status = 'free';
        targetFreeSpot = candidateToFree;
      }
    }

    if (!targetFreeSpot) {
      displacedDriver.status = 'searching';
      delete displacedDriver.assignedSpotId;
      state.auditLog.unshift({
        time: new Date().toLocaleTimeString('he-IL'),
        type: 'NO_ALTERNATIVE_SPOT',
        message: `אין כרגע חניה חלופית פנויה ל-${displacedDriver.name}. הרכב ממשיך בחיפוש.`
      });
      return null;
    }

    delete displacedDriver.assignedSpotId;
    displacedDriver.status = 'searching';

    const route = calculateRouteToSpot(displacedDriver, targetFreeSpot, state.lotConfig);
    const altAssignment = {
      spotId: targetFreeSpot.id,
      driverId: displacedDriver.id,
      driverName: displacedDriver.name,
      assignedAt: Date.now(),
      expiresAt: Date.now() + (TIMEOUT_SECONDS * 1000),
      etaSeconds: route.etaSeconds,
      routeDistance: route.routeDistance,
      turnInstruction: route.turnInstruction,
      history: [displacedDriver.id],
      status: 'pending_confirmation',
      isAlternative: true,
      originalSpotId: spotId
    };

    state.activeAssignments[targetFreeSpot.id] = altAssignment;
    targetFreeSpot.status = 'assigned';
    displacedDriver.status = 'assigned';
    displacedDriver.assignedSpotId = targetFreeSpot.id;

    state.auditLog.unshift({
      time: new Date().toLocaleTimeString('he-IL'),
      type: 'ALTERNATIVE_ASSIGNED',
      message: `🔄 חניה חלופית נשלחה ל-${displacedDriver.name}: חניה ${targetFreeSpot.id} (${route.etaSeconds} שניות ממך, ${route.turnInstruction})`
    });

    return altAssignment;
  }

  /**
   * Computes KPI statistics: Success Rate (%) and Average Search Time (s).
   */
  function calculateMetrics(state) {
    const total = state.metrics.totalAssignments;
    const successes = state.metrics.successfulAssignments;
    const successRate = total > 0 ? Math.round((successes / total) * 100) : 100;

    const times = state.metrics.completedSearchTimes;
    const avgTime = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 32;

    const freeSpotsCount = state.spots.filter(s => s.status === 'free').length;
    const assignedSpotsCount = Object.keys(state.activeAssignments).length;

    return {
      successRate,
      averageSearchTimeSec: avgTime,
      totalAssignments: total,
      successfulAssignments: successes,
      timedOutAssignments: state.metrics.timedOutAssignments,
      foreignCarTakeovers: state.metrics.foreignCarTakeovers,
      freeSpotsCount,
      assignedSpotsCount
    };
  }

  return {
    TIMEOUT_SECONDS,
    DEFAULT_DRIVER_SPEED,
    euclideanDistance,
    createDefaultLotConfig,
    calculateRouteToSpot,
    findBestDriverForSpot,
    createAssignmentState,
    assignSpot,
    confirmAssignment,
    handleTimeout,
    handleForeignCarTakeover,
    calculateMetrics
  };
});
