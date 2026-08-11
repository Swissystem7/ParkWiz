const assert = require("node:assert");
const { aggregateAnonymizedData } = require("./aggregateAnonymizedData.js");

// empty / falsy input
assert.deepStrictEqual(aggregateAnonymizedData([], 1), []);
assert.deepStrictEqual(aggregateAnonymizedData(null, 1), []);

// windowHours guard
assert.throws(() => aggregateAnonymizedData([], 0), /positive/);
assert.throws(() => aggregateAnonymizedData([], -2), /positive/);

// plate is dropped; two records same location + same 1h bin => count 2, no plate field
const recs = [
  { plate: "12-345-67", timestamp: "2026-07-17T08:10:00.000Z", location: "Rothschild-40" },
  { plate: "98-765-43", timestamp: "2026-07-17T08:55:00.000Z", location: "Rothschild-40" },
  { plate: "11-222-33", timestamp: "2026-07-17T09:05:00.000Z", location: "Rothschild-40" },
];
const out = aggregateAnonymizedData(recs, 1);
assert.strictEqual(out.length, 2, "two 1h bins");
const bin8 = out.find((b) => b.timeBinStart === "2026-07-17T08:00:00.000Z");
assert.strictEqual(bin8.count, 2);
assert.strictEqual(bin8.location, "Rothschild-40");
assert.ok(!("plate" in bin8), "plate identifier removed");

// wider window merges bins
const merged = aggregateAnonymizedData(recs, 2);
assert.strictEqual(merged.length, 1);
assert.strictEqual(merged[0].count, 3);

// distinct locations stay separate
const twoLoc = aggregateAnonymizedData([
  { plate: "a", timestamp: "2026-07-17T08:00:00.000Z", location: "A" },
  { plate: "b", timestamp: "2026-07-17T08:00:00.000Z", location: "B" },
], 1);
assert.strictEqual(twoLoc.length, 2);

console.log("ok");
