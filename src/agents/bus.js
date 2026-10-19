// ParkWiz — the single in-page event bus the built-in agents listen on (#269).
//
// The page publishes what it observes (a stall freed, an occupancy sample, a
// driver waiting) and every enabled agent sees the same event. Agents never
// call each other and never touch the DOM: they return actions, which is what
// makes each one unit-testable in plain node with no browser.
//
// Deliberately tiny — no wildcards, no priorities, nothing async. A handler
// that throws is isolated and recorded rather than rethrown: one broken agent
// must not stop the others or put a red console error on an operator's screen
// in the middle of a demo (that is an explicit acceptance item of #269).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizAgentBus = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // The history is for the operator-facing log panel, not an audit trail, so it
  // is a bounded ring: a demo left running overnight must not grow without end.
  const MAX_HISTORY = 200;

  function finiteOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  // An event always carries a string type and a finite `at`. A caller that
  // forgets the timestamp gets "now" rather than an undefined that would later
  // turn every age comparison into NaN (and so silently disable every tick).
  function normalizeEvent(type, payload, at) {
    const evt = Object.assign({}, payload && typeof payload === 'object' ? payload : null);
    evt.type = String(type || '');
    evt.at = finiteOr(at !== undefined ? at : evt.at, Date.now());
    evt.depth = Math.max(0, Math.round(finiteOr(evt.depth, 0)));
    return evt;
  }

  function createBus() {
    const handlers = [];
    const seen = [];
    const errors = [];

    function subscribe(fn) {
      if (typeof fn !== 'function') return function () {};
      handlers.push(fn);
      return function unsubscribe() {
        const i = handlers.indexOf(fn);
        if (i >= 0) handlers.splice(i, 1);
      };
    }

    function emit(type, payload, at) {
      const evt = normalizeEvent(type, payload, at);
      if (!evt.type) return null;
      seen.push(evt);
      if (seen.length > MAX_HISTORY) seen.splice(0, seen.length - MAX_HISTORY);
      // Snapshot: a handler that unsubscribes itself must not shift the list
      // out from under the loop and skip the next agent.
      for (const fn of handlers.slice()) {
        try {
          fn(evt);
        } catch (err) {
          errors.push({ at: evt.at, type: evt.type, message: String((err && err.message) || err) });
        }
      }
      return evt;
    }

    return {
      emit,
      subscribe,
      history: () => seen.slice(),
      errors: () => errors.slice(),
      handlerCount: () => handlers.length,
      reset: () => {
        seen.length = 0;
        errors.length = 0;
      },
    };
  }

  return { createBus, normalizeEvent, MAX_HISTORY };
});
