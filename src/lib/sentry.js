// ParkWiz — browser errors via the Sentry CDN. Disabled unless a deploy step
// replaces the single INJECTED_DSN token with the SENTRY_DSN secret.
// No DSN is committed. Session Replay stays off (no video frames or images).
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ParkWizSentry = api;
  if (typeof document !== 'undefined') api.install();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Split so a replace of the token below does not also rewrite this check.
  var PLACEHOLDER = '__' + 'SENTRY_DSN' + '__';
  var INJECTED_DSN = '__SENTRY_DSN__';
  // Errors-only bundle (no tracing, no Session Replay). See Sentry CDN docs, 11.10.0.
  var SDK_SRC = 'https://browser.sentry-cdn.com/11.10.0/bundle.min.js';
  var SDK_INTEGRITY = 'sha384-O/8YQaGGVy/n9jIUzcOiaiJVm4t5+JMNiK/zOa0fWvlSld+FquXemEcwJxQ3x/Lr';
  var DSN_RE = /^https:\/\/[a-zA-Z0-9]+@[^/?#\s]+\/\d+$/;
  var GEO_KEY = /^(lat|lng|lon|latitude|longitude|geolocation|coords|coordinates|altitude|heading)$/i;

  function resolveDsn(raw) {
    var dsn = String(raw == null ? '' : raw).trim();
    if (!dsn || dsn === PLACEHOLDER || dsn.indexOf(PLACEHOLDER) !== -1) return '';
    if (!DSN_RE.test(dsn)) return '';
    return dsn;
  }

  function scrubString(s) {
    if (/^data:(image|video)\//i.test(s)) return '[Filtered]';
    return s
      .replace(/data:(image|video)\/[^\s"']+/gi, '[Filtered]')
      .replace(/([?&](?:lat|lng|lon|latitude|longitude)=)[^&#\s]*/gi, '$1[Filtered]');
  }

  function scrub(value, depth, seen) {
    if (typeof value === 'string') return scrubString(value);
    if (!value || typeof value !== 'object') return value;
    if (depth > 8 || seen.has(value)) return '[Filtered]';
    seen.add(value);
    if (Array.isArray(value)) {
      return value.map(function (item) { return scrub(item, depth + 1, seen); });
    }
    var out = {};
    Object.keys(value).forEach(function (key) {
      out[key] = GEO_KEY.test(key) ? '[Filtered]' : scrub(value[key], depth + 1, seen);
    });
    return out;
  }

  function containsMedia(value, depth) {
    if (typeof value === 'string') return /data:(image|video)\//i.test(value);
    if (!value || typeof value !== 'object' || depth > 6) return false;
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length; i++) {
      if (containsMedia(value[keys[i]], depth + 1)) return true;
    }
    return false;
  }

  function initOptions(dsn) {
    return {
      dsn: dsn,
      sendDefaultPii: false,
      dataCollection: { userInfo: false },
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      beforeBreadcrumb: function (crumb) {
        try {
          if (containsMedia(crumb, 0)) return null;
          return scrub(crumb, 0, new WeakSet());
        } catch (e) {
          return null;
        }
      },
      beforeSend: function (event) {
        try {
          return scrub(event, 0, new WeakSet());
        } catch (e) {
          return null;
        }
      },
    };
  }

  function reportTestError(Sentry, search) {
    if (!/(?:^|[?&])sentryTest=1(?:&|$)/.test(String(search || ''))) return false;
    if (!Sentry || typeof Sentry.captureException !== 'function') return false;
    Sentry.captureException(new Error('ParkWiz Sentry test error'));
    return true;
  }

  function install(opts) {
    opts = opts || {};
    var doc = opts.document || (typeof document !== 'undefined' ? document : null);
    var dsn = resolveDsn(opts.dsn != null ? opts.dsn : INJECTED_DSN);
    if (!dsn || !doc || typeof doc.createElement !== 'function' || !doc.head) {
      return { enabled: false };
    }
    var script = doc.createElement('script');
    script.src = SDK_SRC;
    script.integrity = SDK_INTEGRITY;
    script.crossOrigin = 'anonymous';
    script.onload = function () {
      var Sentry = typeof opts.getSentry === 'function' ? opts.getSentry() : root.Sentry;
      if (!Sentry || typeof Sentry.init !== 'function') return;
      Sentry.init(initOptions(dsn));
      var search = opts.search != null ? opts.search : (root.location && root.location.search);
      reportTestError(Sentry, search);
    };
    doc.head.appendChild(script);
    return { enabled: true };
  }

  return {
    PLACEHOLDER: PLACEHOLDER,
    SDK_SRC: SDK_SRC,
    resolveDsn: resolveDsn,
    install: install,
  };
});
