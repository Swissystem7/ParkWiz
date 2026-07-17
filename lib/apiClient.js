'use strict';

// apiClient.js — thin ParkWiz backend client (browser + Node, UMD).
// The layer between the validated payload builders (spotPayload / bookingPayload)
// and the DOM: auth + spot listing/creation + booking creation over the live
// backend contract (verified against 127.0.0.1:4000):
//   POST /api/auth/register {email,password,display_name} -> 201 {user, token}
//   POST /api/auth/login    {email,password}              -> 200 {user, token}
//   GET  /api/spots                                       -> 200 [...]
//   POST /api/spots   (Bearer) <spotPayload>              -> 201 {id, owner_id, ...}
//   POST /api/bookings(Bearer) {private_spot_id,start_ts,end_ts} -> 201 {booking, payment}
// The SERVER is authoritative on price/availability; client price fields are
// preview estimates only (see bookingPayload). ponytail: no retry/refresh-token
// logic — add if the JWT's ~7-day expiry starts biting real sessions.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./spotPayload').buildSpotPayload,
      require('./bookingPayload').buildBookingPayload
    );
  } else {
    root.ParkWizAPI = factory(root.buildSpotPayload, root.buildBookingPayload);
  }
})(typeof self !== 'undefined' ? self : this, function (buildSpotPayload, buildBookingPayload) {

  function ValidationError(fields) {
    const e = new Error('invalid form: ' + fields.join(', '));
    e.name = 'ValidationError';
    e.fields = fields;
    return e;
  }

  function createClient(opts) {
    opts = opts || {};
    const base = String(opts.baseUrl || 'http://127.0.0.1:4000').replace(/\/+$/, '');
    const fetchImpl = opts.fetch || (typeof fetch !== 'undefined' ? fetch : null);
    if (!fetchImpl) throw new Error('no fetch available (pass opts.fetch in Node < 18)');
    let token = opts.token || null;

    async function req(method, path, body, auth) {
      const headers = { 'Content-Type': 'application/json' };
      if (auth) {
        if (!token) throw new Error('not authenticated');
        headers.Authorization = 'Bearer ' + token;
      }
      const res = await fetchImpl(base + path, {
        method: method,
        headers: headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      let data = null;
      try { data = await res.json(); } catch (e) { /* empty/non-json body */ }
      if (!res.ok) {
        const err = new Error((data && data.error) || ('HTTP ' + res.status));
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    }

    return {
      get token() { return token; },
      setToken: function (t) { token = t || null; },

      register: async function (email, password, displayName) {
        const d = await req('POST', '/api/auth/register',
          { email: email, password: password, display_name: displayName }, false);
        if (d && d.token) token = d.token;
        return d;
      },
      login: async function (email, password) {
        const d = await req('POST', '/api/auth/login',
          { email: email, password: password }, false);
        if (d && d.token) token = d.token;
        return d;
      },

      listSpots: function () { return req('GET', '/api/spots', null, false); },

      // Raw "host your parking" form -> validated POST /api/spots.
      createSpot: function (form) {
        const r = buildSpotPayload(form);
        if (!r.ok) throw ValidationError(r.errors);
        return req('POST', '/api/spots', r.payload, true);
      },

      // Raw "book this spot" form -> validated POST /api/bookings.
      // Returns { server, estimate }: server = backend {booking,payment};
      // estimate = client-side preview (label as estimate-only in UI).
      createBooking: async function (form, priceOpts) {
        const r = buildBookingPayload(form, priceOpts);
        if (!r.ok) throw ValidationError(r.errors);
        const server = await req('POST', '/api/bookings', r.payload, true);
        return { server: server, estimate: r.estimate };
      },
    };
  }

  return { createClient: createClient, ValidationError: ValidationError };
});
