// The runtime is what the UI panel talks to, so these tests pin the contract
// the panel depends on: a disabled agent is never called, an agent's action
// reaches the other agents, a cascade cannot run away, and a broken agent is
// contained (acceptance item of #269 is "no console errors").
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createBus } = require('../src/agents/bus');
const { createRuntime, MAX_DEPTH } = require('../src/agents/runtime');

function recorder(name, onEvent) {
  const seen = [];
  return {
    seen,
    agent: { name, labelHe: name + ' בעברית', onEvent: (evt) => { seen.push(evt.type); return onEvent ? onEvent(evt) : null; } },
  };
}

test('registered agents are enabled by default and listed with a Hebrew label', () => {
  const runtime = createRuntime({ bus: createBus() });
  runtime.register(recorder('driver').agent);
  assert.deepEqual(runtime.list(), [{ name: 'driver', labelHe: 'driver בעברית', enabled: true }]);
  assert.equal(runtime.isEnabled('driver'), true);
});

test('an agent without a name, or a duplicate name, is rejected', () => {
  const runtime = createRuntime({ bus: createBus() });
  assert.throws(() => runtime.register(null), TypeError);
  assert.throws(() => runtime.register({ onEvent() {} }), TypeError);
  runtime.register({ name: 'driver' });
  assert.throws(() => runtime.register({ name: 'driver' }), /already registered/);
});

test('a disabled agent sees no events and no ticks', () => {
  const bus = createBus();
  const runtime = createRuntime({ bus });
  const rec = recorder('driver');
  let ticks = 0;
  rec.agent.tick = () => { ticks += 1; return null; };
  runtime.register(rec.agent);

  runtime.setEnabled('driver', false);
  bus.emit('spot-freed', {}, 1);
  runtime.tick(2);
  assert.deepEqual(rec.seen, []);
  assert.equal(ticks, 0);

  runtime.setEnabled('driver', true);
  bus.emit('spot-freed', {}, 3);
  runtime.tick(4);
  assert.deepEqual(rec.seen, ['spot-freed']);
  assert.equal(ticks, 1);
});

test('setEnabled on an unknown agent reports failure instead of inventing one', () => {
  const runtime = createRuntime({ bus: createBus() });
  assert.equal(runtime.setEnabled('ghost', false), false);
  assert.equal(runtime.isEnabled('ghost'), false);
  assert.deepEqual(runtime.list(), []);
});

test('an action is re-emitted on the bus so other agents can react to it', () => {
  const bus = createBus();
  const runtime = createRuntime({ bus });
  runtime.register(recorder('driver', (evt) =>
    (evt.type === 'spot-freed' ? { type: 'driver-alert', textHe: 'התראה' } : null)).agent);
  const watcher = recorder('manager');
  runtime.register(watcher.agent);

  bus.emit('spot-freed', { spotId: 'A-01' }, 10);
  assert.deepEqual(watcher.seen, ['spot-freed', 'driver-alert']);
  assert.equal(bus.history().filter((e) => e.type === 'driver-alert').length, 1);
  assert.equal(bus.history().find((e) => e.type === 'driver-alert').by, 'driver');
});

test('an agent never receives its own action', () => {
  const bus = createBus();
  const runtime = createRuntime({ bus });
  const rec = recorder('driver', (evt) =>
    (evt.type === 'spot-freed' ? { type: 'driver-alert', textHe: 'התראה' } : null));
  runtime.register(rec.agent);
  bus.emit('spot-freed', {}, 1);
  assert.deepEqual(rec.seen, ['spot-freed']);
});

test('a cascade of agents reacting to each other stops at MAX_DEPTH', () => {
  const bus = createBus();
  const runtime = createRuntime({ bus });
  // Two agents that answer each other forever if nothing bounds the cascade.
  runtime.register({ name: 'ping', onEvent: (e) => (e.type === 'pong' || e.type === 'go' ? { type: 'ping', textHe: 'p' } : null) });
  runtime.register({ name: 'pong', onEvent: (e) => (e.type === 'ping' ? { type: 'pong', textHe: 'p' } : null) });
  bus.emit('go', {}, 1);
  const depths = bus.history().map((e) => e.depth);
  assert.ok(Math.max(...depths) < MAX_DEPTH, 'cascade exceeded MAX_DEPTH: ' + depths.join(','));
  assert.ok(bus.history().length < 10, 'cascade did not settle: ' + bus.history().length);
});

test('an agent that throws is contained and counted, and the next agent still runs', () => {
  const bus = createBus();
  const runtime = createRuntime({ bus });
  runtime.register({ name: 'broken', onEvent() { throw new Error('bad agent'); }, tick() { throw new Error('bad tick'); } });
  const healthy = recorder('healthy');
  runtime.register(healthy.agent);

  assert.doesNotThrow(() => bus.emit('spot-freed', {}, 1));
  assert.doesNotThrow(() => runtime.tick(2));
  assert.deepEqual(healthy.seen, ['spot-freed']);
  assert.deepEqual(runtime.failures().map((f) => f.phase), ['onEvent', 'tick']);
});

test('a throwing report() does not blank out the other agents reports', () => {
  const runtime = createRuntime({ bus: createBus() });
  runtime.register({ name: 'broken', report() { throw new Error('no report'); } });
  runtime.register({ name: 'ok', labelHe: 'תקין', report: () => ({ textHe: 'בסדר' }) });
  const reports = runtime.reports();
  assert.equal(reports[0].report, null);
  assert.deepEqual(reports[1], { name: 'ok', labelHe: 'תקין', enabled: true, report: { textHe: 'בסדר' } });
  assert.equal(runtime.failures()[0].phase, 'report');
});

test('reports include a disabled agent, flagged, so the panel can grey it out', () => {
  const runtime = createRuntime({ bus: createBus() });
  runtime.register({ name: 'manager', report: () => ({ textHe: 'סיכום' }) });
  runtime.setEnabled('manager', false);
  assert.equal(runtime.reports()[0].enabled, false);
});

test('the action log keeps the newest entries with agent, type and Hebrew text', () => {
  const bus = createBus();
  const runtime = createRuntime({ bus, logLimit: 3 });
  let n = 0;
  runtime.register({ name: 'driver', onEvent: () => ({ type: 'driver-alert', textHe: 'התראה ' + (++n) }) });
  for (let i = 0; i < 5; i++) bus.emit('spot-freed', {}, 100 + i);
  const log = runtime.log();
  assert.equal(log.length, 3);
  assert.deepEqual(log.map((e) => e.textHe), ['התראה 3', 'התראה 4', 'התראה 5']);
  assert.deepEqual(log[0], { at: 102, agent: 'driver', type: 'driver-alert', textHe: 'התראה 3' });
});

test('an action without a type is dropped instead of logged as a blank line', () => {
  const bus = createBus();
  const runtime = createRuntime({ bus });
  runtime.register({ name: 'driver', onEvent: () => [null, { textHe: 'no type' }, 'nope'] });
  bus.emit('spot-freed', {}, 1);
  assert.deepEqual(runtime.log(), []);
});

test('tick defaults to the real clock but honours an injected now', () => {
  const runtime = createRuntime({ bus: createBus() });
  const nows = [];
  runtime.register({ name: 'driver', tick: (now) => { nows.push(now); return null; } });
  runtime.tick(4242);
  runtime.tick();
  assert.equal(nows[0], 4242);
  assert.ok(Number.isFinite(nows[1]));
});

test('stop() detaches the runtime from the bus', () => {
  const bus = createBus();
  const runtime = createRuntime({ bus });
  const rec = recorder('driver');
  runtime.register(rec.agent);
  runtime.stop();
  bus.emit('spot-freed', {}, 1);
  assert.deepEqual(rec.seen, []);
});

test('a runtime with no bus still dispatches and ticks for unit tests', () => {
  const runtime = createRuntime({});
  runtime.register({ name: 'driver', onEvent: () => ({ type: 'driver-alert', textHe: 'התראה' }) });
  const actions = runtime.dispatch({ type: 'spot-freed', at: 1, depth: 0 });
  assert.equal(actions.length, 1);
  assert.equal(runtime.log().length, 1);
  assert.doesNotThrow(() => runtime.stop());
});
