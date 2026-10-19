// ParkWiz — the runtime that hosts the built-in agents (#269).
//
// Every agent is the same shape, so the panel in the UI needs no per-agent
// code: { name, labelHe, onEvent(evt) -> actions, tick(now) -> actions,
// report() }. onEvent and tick are pure as far as the page is concerned — they
// return *actions* ({ type, textHe, ...payload }) and the runtime is the only
// thing allowed to put them back on the bus. That inversion is what keeps the
// agents testable without a DOM and what lets an operator switch one off
// mid-demo: a disabled agent is simply never called.
//
// Two bounded things on purpose: a re-emitted action carries depth+1 and stops
// at MAX_DEPTH (an agent reacting to its own action can never spin the page),
// and the action log is a ring of the last LOG_LIMIT entries.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizAgentRuntime = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MAX_DEPTH = 3;
  const LOG_LIMIT = 40;

  function asActions(result) {
    if (!result) return [];
    const list = Array.isArray(result) ? result : [result];
    return list.filter((a) => a && typeof a === 'object' && a.type);
  }

  function createRuntime(options) {
    const opts = options || {};
    const bus = opts.bus;
    const logLimit = Number.isFinite(opts.logLimit) ? Math.max(1, opts.logLimit) : LOG_LIMIT;
    const agents = [];
    const enabled = Object.create(null);
    const log = [];
    const failures = [];
    const pending = [];
    let draining = false;

    function record(agentName, action, at) {
      log.push({ at, agent: agentName, type: action.type, textHe: String(action.textHe || '') });
      if (log.length > logLimit) log.splice(0, log.length - logLimit);
    }

    // One agent throwing is a bug in that agent, not a reason for the operator
    // to lose the other three. It is counted so a test can see it happened.
    function safely(agent, phase, fn, fallback) {
      try {
        return fn();
      } catch (err) {
        failures.push({ agent: agent.name, phase, message: String((err && err.message) || err) });
        return fallback;
      }
    }

    // Actions are queued, not emitted inline. Emitting inline let an agent's
    // own action overtake the event that caused it: the manager saw the
    // driver-alert for a stall before it saw that stall being freed, purely
    // because the driver happens to be registered first. Queueing makes the
    // order the obvious one — every agent sees the event, then the actions.
    function run(agent, phase, fn, at, depth) {
      const actions = asActions(safely(agent, phase, fn, null));
      for (const action of actions) {
        record(agent.name, action, at);
        if (bus && depth + 1 < MAX_DEPTH) {
          pending.push({ action, at, by: agent.name, depth: depth + 1 });
        }
      }
      return actions;
    }

    // Only the outermost pass drains: a re-entrant call (bus.emit below lands
    // back in dispatch) appends to the same queue and returns.
    function drain() {
      if (draining) return;
      draining = true;
      try {
        while (pending.length > 0) {
          const next = pending.shift();
          bus.emit(next.action.type, Object.assign({}, next.action, { by: next.by, depth: next.depth }), next.at);
        }
      } finally {
        draining = false;
      }
    }

    function register(agent) {
      if (!agent || typeof agent !== 'object' || !agent.name) {
        throw new TypeError('an agent needs a name');
      }
      if (agents.some((a) => a.name === agent.name)) {
        throw new TypeError('agent already registered: ' + agent.name);
      }
      agents.push(agent);
      // Agents are on by default: the acceptance run of #269 is "open the page
      // and see the driver alert", not "open the page and switch things on".
      enabled[agent.name] = true;
      return agent;
    }

    function setEnabled(name, on) {
      if (!(name in enabled)) return false;
      enabled[name] = Boolean(on);
      return true;
    }

    function dispatch(evt) {
      if (!evt || !evt.type) return [];
      const depth = Math.max(0, Number(evt.depth) || 0);
      const out = [];
      for (const agent of agents) {
        if (!enabled[agent.name] || typeof agent.onEvent !== 'function') continue;
        // An agent never reacts to its own action: that is the one cycle a
        // depth counter alone would still let through twice.
        if (evt.by === agent.name) continue;
        out.push(...run(agent, 'onEvent', () => agent.onEvent(evt), evt.at, depth));
      }
      if (bus) drain();
      return out;
    }

    function tick(now) {
      const at = Number.isFinite(now) ? now : Date.now();
      const out = [];
      for (const agent of agents) {
        if (!enabled[agent.name] || typeof agent.tick !== 'function') continue;
        out.push(...run(agent, 'tick', () => agent.tick(at), at, 0));
      }
      if (bus) drain();
      return out;
    }

    const unsubscribe = bus ? bus.subscribe(dispatch) : function () {};

    return {
      register,
      setEnabled,
      isEnabled: (name) => Boolean(enabled[name]),
      list: () => agents.map((a) => ({ name: a.name, labelHe: a.labelHe || a.name, enabled: Boolean(enabled[a.name]) })),
      dispatch,
      tick,
      reports: () => agents.map((a) => ({
        name: a.name,
        labelHe: a.labelHe || a.name,
        enabled: Boolean(enabled[a.name]),
        report: typeof a.report === 'function' ? safely(a, 'report', () => a.report(), null) : null,
      })),
      log: () => log.slice(),
      failures: () => failures.slice(),
      stop: unsubscribe,
    };
  }

  return { createRuntime, MAX_DEPTH, LOG_LIMIT };
});
