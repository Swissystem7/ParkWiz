const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

for (const rel of ["demo/atidim-board.html", "demo/commute.html"]) {
  test(`${rel} loads the freshness indicator`, () => {
    const html = fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
    assert.match(html, /pwFreshness/);
    assert.match(html, /src\/lib\/freshness\.js/);
  });
}

test("freshness script shows update age and marks data older than 5 minutes as stale", () => {
  const js = fs.readFileSync(path.join(__dirname, "..", "src/lib/freshness.js"), "utf8");
  assert.match(js, /עודכן לפני/);
  assert.match(js, /יותר מ-5 דקות/);
  assert.match(js, /יכול להיתפס אחריו/);
  assert.match(js, /sec > staleThreshold/);
  assert.match(js, /staleThreshold\s*=\s*.*:\s*300|:\s*300/);
});

function withFreshnessHarness(options, fn) {
  if (typeof options === "function") {
    fn = options;
    options = {};
  }
  options = options || {};

  const origDoc = global.document;
  const origNow = Date.now;
  const origSetInterval = global.setInterval;

  let currentTime = 1000000;
  Date.now = () => currentTime;

  let intervalFn = null;
  global.setInterval = (cb) => {
    intervalFn = cb;
    return 1;
  };

  const listeners = {};
  const el = options.hasEl !== false
    ? {
        textContent: "",
        style: { color: "", fontWeight: "" },
        getAttribute: (attr) => (options.elAttrs && Object.prototype.hasOwnProperty.call(options.elAttrs, attr) ? options.elAttrs[attr] : null),
      }
    : null;

  const script = options.scriptAttrs
    ? {
        getAttribute: (attr) => (Object.prototype.hasOwnProperty.call(options.scriptAttrs, attr) ? options.scriptAttrs[attr] : null),
      }
    : null;

  global.document = {
    currentScript: script,
    getElementById: (id) => (id === "pwFreshness" ? el : null),
  };

  if (options.hasAddEventListener !== false) {
    global.document.addEventListener = (type, cb) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(cb);
    };
  }

  const freshnessPath = require.resolve("../src/lib/freshness.js");
  delete require.cache[freshnessPath];

  try {
    require(freshnessPath);
    const harness = {
      el,
      tick: () => {
        if (intervalFn) intervalFn();
      },
      advanceSec: (sec) => {
        currentTime += sec * 1000;
        if (intervalFn) intervalFn();
      },
      triggerInput: () => {
        if (listeners.input) {
          for (const cb of listeners.input) cb();
        }
      },
    };
    return fn(harness);
  } finally {
    global.document = origDoc;
    Date.now = origNow;
    global.setInterval = origSetInterval;
  }
}

test("default behavior without attribute: 'לא עדכני' only after 300 seconds", () => {
  withFreshnessHarness((harness) => {
    assert.equal(harness.el.textContent, "עודכן לפני 0 שניות — מקום פנוי נכון לרגע העדכון, ויכול להיתפס אחריו");
    assert.equal(harness.el.style.color, "");
    assert.equal(harness.el.style.fontWeight, "");

    harness.tick();
    assert.equal(harness.el.textContent, "עודכן לפני 0 שניות — מקום פנוי נכון לרגע העדכון, ויכול להיתפס אחריו");

    harness.advanceSec(300);
    assert.equal(harness.el.textContent, "עודכן לפני 300 שניות — מקום פנוי נכון לרגע העדכון, ויכול להיתפס אחריו");
    assert.equal(harness.el.style.color, "");
    assert.equal(harness.el.style.fontWeight, "");

    harness.advanceSec(1);
    assert.match(harness.el.textContent, /לא עדכני/);
    assert.equal(harness.el.style.color, "var(--pw-danger,#dc2626)");
    assert.equal(harness.el.style.fontWeight, "700");
  });
});

test("custom data-stale-sec='60' on script: marks 'לא עדכני' at 61 seconds", () => {
  withFreshnessHarness({ scriptAttrs: { "data-stale-sec": "60" } }, (harness) => {
    harness.advanceSec(60);
    assert.equal(harness.el.textContent, "עודכן לפני 60 שניות — מקום פנוי נכון לרגע העדכון, ויכול להיתפס אחריו");
    assert.equal(harness.el.style.color, "");

    harness.advanceSec(1);
    assert.match(harness.el.textContent, /לא עדכני/);
    assert.equal(harness.el.style.color, "var(--pw-danger,#dc2626)");
    assert.equal(harness.el.style.fontWeight, "700");
  });
});

test("custom data-stale-sec='60' on #pwFreshness: marks 'לא עדכני' at 61 seconds", () => {
  withFreshnessHarness({ elAttrs: { "data-stale-sec": "60" } }, (harness) => {
    harness.advanceSec(60);
    assert.equal(harness.el.textContent, "עודכן לפני 60 שניות — מקום פנוי נכון לרגע העדכון, ויכול להיתפס אחריו");
    assert.equal(harness.el.style.color, "");

    harness.advanceSec(1);
    assert.match(harness.el.textContent, /לא עדכני/);
    assert.equal(harness.el.style.color, "var(--pw-danger,#dc2626)");
    assert.equal(harness.el.style.fontWeight, "700");
  });
});

test("invalid values safely fall back to 300 with zero JS errors", () => {
  const invalidCases = [
    { label: "negative number on script", scriptAttrs: { "data-stale-sec": "-5" } },
    { label: "negative number on element", elAttrs: { "data-stale-sec": "-5" } },
    { label: "non-numeric string on script", scriptAttrs: { "data-stale-sec": "invalid" } },
    { label: "non-numeric string on element", elAttrs: { "data-stale-sec": "invalid" } },
    { label: "empty string on script", scriptAttrs: { "data-stale-sec": "" } },
    { label: "empty string on element", elAttrs: { "data-stale-sec": "" } },
    { label: "zero on script", scriptAttrs: { "data-stale-sec": "0" } },
    { label: "whitespace on element", elAttrs: { "data-stale-sec": "   " } },
  ];

  for (const c of invalidCases) {
    withFreshnessHarness(c, (harness) => {
      harness.advanceSec(300);
      assert.doesNotMatch(harness.el.textContent, /לא עדכני/, `${c.label} should not be stale at 300s`);
      harness.advanceSec(1);
      assert.match(harness.el.textContent, /לא עדכני/, `${c.label} should be stale at 301s`);
    });
  }
});

test("input event resets the timer as before", () => {
  withFreshnessHarness((harness) => {
    harness.advanceSec(305);
    assert.match(harness.el.textContent, /לא עדכני/);

    harness.triggerInput();
    assert.equal(harness.el.textContent, "עודכן לפני 0 שניות — מקום פנוי נכון לרגע העדכון, ויכול להיתפס אחריו");
    assert.equal(harness.el.style.color, "");
    assert.equal(harness.el.style.fontWeight, "");

    harness.advanceSec(10);
    assert.equal(harness.el.textContent, "עודכן לפני 10 שניות — מקום פנוי נכון לרגע העדכון, ויכול להיתפס אחריו");

    harness.advanceSec(291);
    assert.match(harness.el.textContent, /לא עדכני/);
  });
});

test("edge cases: missing pwFreshness element, missing addEventListener, or no document", () => {
  // Missing pwFreshness
  assert.doesNotThrow(() => {
    withFreshnessHarness({ hasEl: false }, () => {});
  });

  // Missing addEventListener
  assert.doesNotThrow(() => {
    withFreshnessHarness({ hasAddEventListener: false }, () => {});
  });

  // No document global
  const origDoc = global.document;
  delete global.document;
  const freshnessPath = require.resolve("../src/lib/freshness.js");
  delete require.cache[freshnessPath];
  try {
    assert.doesNotThrow(() => {
      require(freshnessPath);
    });
  } finally {
    global.document = origDoc;
  }
});
