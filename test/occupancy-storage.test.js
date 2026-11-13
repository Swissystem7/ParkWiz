const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const occ = require('../src/lib/occupancy');

const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function restoreLocalStorage() {
  if (originalDescriptor) {
    Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
  } else {
    delete globalThis.localStorage;
  }
}

afterEach(() => {
  restoreLocalStorage();
});

function createMockStorage(options = {}) {
  const store = new Map();
  return {
    _store: store,
    getItem(key) {
      if (options.throwGet) {
        const err = new Error('SecurityError: storage access denied');
        err.name = 'SecurityError';
        throw err;
      }
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    setItem(key, value) {
      if (options.throwSet) {
        const err = new Error('QuotaExceededError: storage quota exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      }
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key(index) {
      return Array.from(store.keys())[index] || null;
    },
  };
}

test('summarize: returns empty stats object when passed empty array, null, or undefined', () => {
  const expectedEmpty = {
    count: 0,
    last: null,
    first: null,
    peak: null,
    low: null,
    avg: 0,
    conf: 0,
    sources: [],
  };

  assert.deepEqual(occ.summarize([]), expectedEmpty);
  assert.deepEqual(occ.summarize(null), expectedEmpty);
  assert.deepEqual(occ.summarize(undefined), expectedEmpty);
  assert.deepEqual(occ.summarize(), expectedEmpty);
  assert.deepEqual(occ.summarize('not an array'), expectedEmpty);
});

test('loadStoredOccupancy: returns [] when localStorage has no item under occ.LS.occupancy', () => {
  const mockStorage = createMockStorage();
  globalThis.localStorage = mockStorage;

  assert.equal(occ.LS.occupancy, 'pw_pilot_occupancy');
  const result = occ.loadStoredOccupancy();
  assert.deepEqual(result, []);
});

test('loadStoredOccupancy: returns [] when stored item is an empty string', () => {
  const mockStorage = createMockStorage();
  mockStorage.setItem(occ.LS.occupancy, '');
  globalThis.localStorage = mockStorage;

  const result = occ.loadStoredOccupancy();
  assert.deepEqual(result, []);
});

test('loadStoredOccupancy: returns parsed and normalized records for a valid JSON array', () => {
  const mockStorage = createMockStorage();
  const rawList = [
    { ts: '2026-08-12T08:00:00', street: 'הרצל', total: 10, occupied: 3, source: 'sample', confidence: 0.8 },
    { ts: '2026-08-12T09:00:00', street: 'הרצל', total: 10, occupied: 7, source: 'sample', confidence: 0.9 },
  ];
  mockStorage.setItem(occ.LS.occupancy, JSON.stringify(rawList));
  globalThis.localStorage = mockStorage;

  const result = occ.loadStoredOccupancy();
  assert.equal(result.length, 2);
  assert.equal(result[0].ts, '2026-08-12T08:00:00');
  assert.equal(result[0].occupied, 3);
  assert.equal(result[0].total, 10);
  assert.equal(result[0].source, 'sample');
  assert.equal(result[0].confidence, 0.8);
  assert.equal(result[1].ts, '2026-08-12T09:00:00');
  assert.equal(result[1].occupied, 7);
  assert.equal(result[1].total, 10);
  assert.equal(result[1].source, 'sample');
  assert.equal(result[1].confidence, 0.9);
});

test('loadStoredOccupancy: returns parsed and normalized records for a valid JSONL string', () => {
  const mockStorage = createMockStorage();
  const jsonl = [
    JSON.stringify({ ts: '2026-08-12T08:00:00', street: 'הרצל', total: 12, occupied: 4, source: 'kit', confidence: 0.5 }),
    JSON.stringify({ ts: '2026-08-12T09:00:00', street: 'הרצל', total: 12, occupied: 6, source: 'kit', confidence: 0.7 }),
  ].join('\n');
  mockStorage.setItem(occ.LS.occupancy, jsonl);
  globalThis.localStorage = mockStorage;

  const result = occ.loadStoredOccupancy();
  assert.equal(result.length, 2);
  assert.equal(result[0].ts, '2026-08-12T08:00:00');
  assert.equal(result[0].occupied, 4);
  assert.equal(result[0].source, 'kit');
  assert.equal(result[1].ts, '2026-08-12T09:00:00');
  assert.equal(result[1].occupied, 6);
  assert.equal(result[1].confidence, 0.7);
});

test('loadStoredOccupancy: returns [] gracefully when stored content is invalid or malformed JSON', () => {
  const mockStorage = createMockStorage();
  mockStorage.setItem(occ.LS.occupancy, '{not valid json:');
  globalThis.localStorage = mockStorage;

  const result = occ.loadStoredOccupancy();
  assert.deepEqual(result, []);
});

test('loadStoredOccupancy: returns [] gracefully when stored content is a malformed JSON array', () => {
  const mockStorage = createMockStorage();
  mockStorage.setItem(occ.LS.occupancy, '[{"ts": "incomplete');
  globalThis.localStorage = mockStorage;

  const result = occ.loadStoredOccupancy();
  assert.deepEqual(result, []);
});

test('loadStoredOccupancy: returns [] gracefully when localStorage.getItem throws (e.g. SecurityError)', () => {
  const mockStorage = createMockStorage({ throwGet: true });
  globalThis.localStorage = mockStorage;

  const result = occ.loadStoredOccupancy();
  assert.deepEqual(result, []);
});

test('loadStoredOccupancy: returns [] gracefully when localStorage is undefined', () => {
  delete globalThis.localStorage;

  const result = occ.loadStoredOccupancy();
  assert.deepEqual(result, []);
});

test('saveOccupancy: serializes the list as JSON into localStorage under occ.LS.occupancy', () => {
  const mockStorage = createMockStorage();
  globalThis.localStorage = mockStorage;

  const list = [
    { ts: '2026-08-12T10:00:00', street: 'הרצל', total: 20, occupied: 8 },
    { ts: '2026-08-12T11:00:00', street: 'הרצל', total: 20, occupied: 12 },
  ];
  occ.saveOccupancy(list);

  const raw = mockStorage.getItem(occ.LS.occupancy);
  assert.equal(raw, JSON.stringify(list));
  assert.deepEqual(JSON.parse(raw), list);
});

test('saveOccupancy: serializes [] when passed null', () => {
  const mockStorage = createMockStorage();
  globalThis.localStorage = mockStorage;

  occ.saveOccupancy(null);
  assert.equal(mockStorage.getItem(occ.LS.occupancy), '[]');
});

test('saveOccupancy: serializes [] when passed undefined', () => {
  const mockStorage = createMockStorage();
  globalThis.localStorage = mockStorage;

  occ.saveOccupancy(undefined);
  assert.equal(mockStorage.getItem(occ.LS.occupancy), '[]');
});

test('saveOccupancy: catches and silently ignores errors when localStorage.setItem throws (e.g. QuotaExceededError)', () => {
  const mockStorage = createMockStorage({ throwSet: true });
  globalThis.localStorage = mockStorage;

  assert.doesNotThrow(() => {
    occ.saveOccupancy([{ ts: '2026-08-12T12:00:00', street: 'הרצל', total: 10, occupied: 5 }]);
  });
});

test('saveOccupancy: catches and silently ignores errors when localStorage is undefined', () => {
  delete globalThis.localStorage;

  assert.doesNotThrow(() => {
    occ.saveOccupancy([{ ts: '2026-08-12T12:00:00', street: 'הרצל', total: 10, occupied: 5 }]);
  });
});
