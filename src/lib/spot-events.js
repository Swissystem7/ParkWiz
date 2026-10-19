// ParkWiz — spot-freed events (issue #263, step 1).
// Pure functions, zero dependencies, UMD pattern.
//
// The moment a marked stall goes occupied -> free, the lot has something to
// say to a driver circling outside. This module is the whole vocabulary:
//   * detectFreed  — diff two snapshots of the same frame into event objects
//                    { lot, spotId, freedAt, freeCount }.
//   * createFeed   — the last N events, newest first, for a visible list.
//   * publish      — fan the event out to this page (CustomEvent) and to other
//                    tabs on the same browser (BroadcastChannel).
//   * notify       — a browser Notification, so a phone with the tab in the
//                    background still buzzes.
// Deliberately browser-only: no server, no webhook, no MQTT. A fleet relay and
// car-to-car claiming are separate issues; keeping the transport out of here
// means those can subscribe to the same event shape later without a rewrite.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizSpotEvents = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const EVENT_NAME = 'parkwiz:spot-freed';
  const CHANNEL_NAME = 'parkwiz';
  const FEED_LIMIT = 20;
  const TITLE_HE = 'מקום התפנה!';

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function globalScope() {
    return typeof globalThis !== 'undefined' ? globalThis : {};
  }

  function toIso(at) {
    const d = at instanceof Date ? at : (at === undefined || at === null ? new Date() : new Date(at));
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  function freeCountOf(spots) {
    return (Array.isArray(spots) ? spots : []).filter((s) => s && !s.occupied).length;
  }

  // Stalls are matched by id, not by position: switching cameras swaps the whole
  // frame for a different zone, and an index diff would then report every stall
  // in the new view as freshly freed. An id missing from `before` is a stall we
  // have never seen, which is not a freeing either.
  function detectFreed(before, after, options) {
    const opts = options || {};
    const wasOccupied = {};
    (Array.isArray(before) ? before : []).forEach((s) => {
      if (s && s.id !== undefined && s.id !== null) wasOccupied[String(s.id)] = Boolean(s.occupied);
    });
    const lot = String(opts.lot || 'unknown');
    const freedAt = toIso(opts.at);
    // Free bays in the same snapshot the event came from, so the count a driver
    // reads can never describe a frame other than the one that just changed.
    const freeCount = freeCountOf(after);
    const out = [];
    (Array.isArray(after) ? after : []).forEach((s) => {
      if (!s || s.id === undefined || s.id === null) return;
      if (wasOccupied[String(s.id)] === true && !s.occupied) {
        out.push({ lot, spotId: String(s.id), freedAt, freeCount });
      }
    });
    return out;
  }

  // Newest first and capped: the last thing that happened belongs at the top,
  // and an uncapped list grows for as long as the demo is left running.
  function createFeed(limit) {
    const cap = Math.max(1, Math.trunc(Number(limit) || FEED_LIMIT));
    const items = [];
    return {
      limit: cap,
      push(event) {
        if (event) {
          items.unshift(event);
          if (items.length > cap) items.length = cap;
        }
        return items.slice();
      },
      list() { return items.slice(); },
      size() { return items.length; },
      clear() { items.length = 0; },
    };
  }

  // `timeLabel` lets a caller pass the lot's own wall clock (Park Atidim reads
  // Israel time); without one we fall back to the host's local clock.
  function describeHe(event, timeLabel) {
    if (!event) return '';
    let stamp = timeLabel;
    if (!stamp) {
      const d = new Date(event.freedAt);
      stamp = isNaN(d.getTime())
        ? '--:--:--'
        : pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
    }
    return 'תא ' + event.spotId + ' התפנה · ' + event.freeCount + ' פנויים בפריים · ' + stamp;
  }

  // One channel per page, created lazily: constructing a BroadcastChannel throws
  // in a few locked-down WebViews, and a demo must not die for want of a relay.
  function openChannel(scope) {
    const host = scope || globalScope();
    try {
      if (typeof host.BroadcastChannel === 'function') return new host.BroadcastChannel(CHANNEL_NAME);
    } catch (err) {
      /* no cross-tab relay; the page still works on its own */
    }
    return null;
  }

  // Both fan-outs are independent and both are optional, so a page running
  // without a DOM event target still reaches the channel and vice versa.
  function publish(event, options) {
    const opts = options || {};
    const scope = opts.scope || globalScope();
    const out = { dispatched: false, broadcast: false };
    if (!event) return out;
    try {
      if (typeof scope.dispatchEvent === 'function' && typeof scope.CustomEvent === 'function') {
        scope.dispatchEvent(new scope.CustomEvent(EVENT_NAME, { detail: event }));
        out.dispatched = true;
      }
    } catch (err) {
      /* ignore: a listener that throws must not stop the broadcast below */
    }
    try {
      const channel = opts.channel;
      if (channel && typeof channel.postMessage === 'function') {
        channel.postMessage({ type: EVENT_NAME, event });
        out.broadcast = true;
      }
    } catch (err) {
      /* channel closed mid-demo */
    }
    return out;
  }

  // Receive side of the channel. The traffic is same-origin, but it still comes
  // from outside this page, and a feed rendered with innerHTML must not take a
  // stall id on trust. Returns a normalized event, or null for anything that is
  // not one — including a message some other ParkWiz feature put on the channel.
  const SPOT_ID_RE = /^[A-Za-z0-9_-]{1,16}$/;
  const LOT_ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

  function fromMessage(data) {
    if (!data || data.type !== EVENT_NAME || !data.event) return null;
    const ev = data.event;
    const spotId = String(ev.spotId === undefined || ev.spotId === null ? '' : ev.spotId);
    const lot = String(ev.lot === undefined || ev.lot === null ? '' : ev.lot);
    const freeCount = Number(ev.freeCount);
    if (!SPOT_ID_RE.test(spotId) || !LOT_ID_RE.test(lot) || !Number.isFinite(freeCount)) return null;
    return { lot, spotId, freedAt: toIso(ev.freedAt), freeCount: Math.max(0, Math.trunc(freeCount)) };
  }

  // Permission is never requested here. Prompting on page load is the fastest
  // way to be blocked permanently, so the page asks on an explicit click and
  // this function only reports what the current permission allows.
  function notify(event, options) {
    const opts = options || {};
    const scope = opts.scope || globalScope();
    const Ctor = scope.Notification;
    if (!event || typeof Ctor !== 'function') return 'unsupported';
    if (Ctor.permission !== 'granted') return Ctor.permission === 'denied' ? 'denied' : 'default';
    try {
      // One tag per stall: a stall that frees twice replaces its own banner
      // instead of stacking a second one on the driver's lock screen.
      new Ctor(TITLE_HE, {
        body: describeHe(event, opts.timeLabel),
        tag: EVENT_NAME + ':' + event.spotId,
      });
      return 'shown';
    } catch (err) {
      return 'failed';
    }
  }

  return {
    EVENT_NAME,
    CHANNEL_NAME,
    FEED_LIMIT,
    TITLE_HE,
    freeCountOf,
    detectFreed,
    createFeed,
    describeHe,
    openChannel,
    publish,
    fromMessage,
    notify,
  };
});
