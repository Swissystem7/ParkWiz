// The bus is the one thing every agent shares, so these tests pin the two
// properties the rest of src/agents relies on: an event always has a finite
// `at`, and a handler that throws cannot take the other handlers down with it.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createBus, normalizeEvent, MAX_HISTORY } = require('../src/agents/bus');

test('every subscriber sees the same emitted event', () => {
  const bus = createBus();
  const a = [];
  const b = [];
  bus.subscribe((evt) => a.push(evt));
  bus.subscribe((evt) => b.push(evt));
  bus.emit('spot-freed', { spotId: 'A-07' }, 1000);
  assert.equal(a.length, 1);
  assert.deepEqual(a, b);
  assert.equal(a[0].spotId, 'A-07');
  assert.equal(a[0].at, 1000);
});

test('unsubscribe stops delivery and is safe to call twice', () => {
  const bus = createBus();
  const seen = [];
  const off = bus.subscribe((evt) => seen.push(evt.type));
  bus.emit('one', {}, 1);
  off();
  off();
  bus.emit('two', {}, 2);
  assert.deepEqual(seen, ['one']);
  assert.equal(bus.handlerCount(), 0);
});

test('a handler that unsubscribes itself does not skip the next handler', () => {
  const bus = createBus();
  const seen = [];
  const off = bus.subscribe(() => { seen.push('first'); off(); });
  bus.subscribe(() => seen.push('second'));
  bus.emit('spot-freed', {}, 1);
  assert.deepEqual(seen, ['first', 'second']);
});

test('a throwing handler is recorded, not rethrown, and the others still run', () => {
  const bus = createBus();
  const seen = [];
  bus.subscribe(() => { throw new Error('agent exploded'); });
  bus.subscribe(() => seen.push('ran'));
  assert.doesNotThrow(() => bus.emit('spot-freed', {}, 5));
  assert.deepEqual(seen, ['ran']);
  assert.equal(bus.errors().length, 1);
  assert.match(bus.errors()[0].message, /agent exploded/);
});

test('a missing timestamp becomes now instead of NaN', () => {
  const evt = normalizeEvent('spot-freed', { spotId: 'A-01' });
  assert.ok(Number.isFinite(evt.at));
  for (const bad of [undefined, null, 'later', NaN, {}]) {
    assert.ok(Number.isFinite(normalizeEvent('x', { at: bad }).at), String(bad));
  }
});

test('an event with no type is dropped rather than broadcast', () => {
  const bus = createBus();
  const seen = [];
  bus.subscribe((evt) => seen.push(evt));
  assert.equal(bus.emit('', {}, 1), null);
  assert.equal(bus.emit(null, {}, 1), null);
  assert.deepEqual(seen, []);
  assert.deepEqual(bus.history(), []);
});

test('depth is always a non-negative integer', () => {
  assert.equal(normalizeEvent('x', {}).depth, 0);
  assert.equal(normalizeEvent('x', { depth: -4 }).depth, 0);
  assert.equal(normalizeEvent('x', { depth: 'two' }).depth, 0);
  assert.equal(normalizeEvent('x', { depth: 2.4 }).depth, 2);
});

test('history is a bounded ring so an all-day demo cannot grow without end', () => {
  const bus = createBus();
  for (let i = 0; i < MAX_HISTORY + 25; i++) bus.emit('tick', { i }, i);
  const history = bus.history();
  assert.equal(history.length, MAX_HISTORY);
  assert.equal(history[history.length - 1].i, MAX_HISTORY + 24);
});

test('history is a copy, so a caller cannot mutate the bus', () => {
  const bus = createBus();
  bus.emit('spot-freed', {}, 1);
  bus.history().push({ type: 'forged' });
  assert.equal(bus.history().length, 1);
});

test('reset clears history and errors but keeps subscribers', () => {
  const bus = createBus();
  const seen = [];
  bus.subscribe((evt) => seen.push(evt.type));
  bus.emit('spot-freed', {}, 1);
  bus.reset();
  assert.deepEqual(bus.history(), []);
  bus.emit('spot-taken', {}, 2);
  assert.deepEqual(seen, ['spot-freed', 'spot-taken']);
});

test('a non-function subscriber is ignored instead of breaking the next emit', () => {
  const bus = createBus();
  assert.doesNotThrow(() => bus.subscribe(null)());
  assert.equal(bus.handlerCount(), 0);
  assert.doesNotThrow(() => bus.emit('spot-freed', {}, 1));
});
