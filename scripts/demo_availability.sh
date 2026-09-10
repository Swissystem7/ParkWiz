#!/usr/bin/env bash
# ParkWiz offline availability validation demo.
# Prints authorized (accepted) vs unauthorized (rejected) examples.
# No network. Exit 0 on success.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

node <<'NODE'
const { weightedAvailability, HALF_LIFE_MS } = require('./src/lib/availability');
const NOW = 1_000_000_000_000;

function show(label, fn) {
  try {
    const v = fn();
    console.log(`[authorized] ${label} => score=${v}`);
  } catch (e) {
    console.log(`[unauthorized] ${label} => ${e.name}: ${e.message}`);
  }
}

console.log('ParkWiz availability validation demo (offline)');
console.log('validate=true rejects bad reports; good reports score normally.\n');

show('fresh open-spot report', () =>
  weightedAvailability([{ ts: NOW, delta: 1 }], NOW, true)
);
show('half-life decayed report', () =>
  weightedAvailability([{ ts: NOW - HALF_LIFE_MS, delta: 2 }], NOW, true)
);
show('empty report list', () => weightedAvailability([], NOW, true));

show('future timestamp (RangeError)', () =>
  weightedAvailability([{ ts: NOW + 1000, delta: 1 }], NOW, true)
);
show('non-array reports (TypeError)', () =>
  weightedAvailability(null, NOW, true)
);
show('non-array string reports (TypeError)', () =>
  weightedAvailability('not-an-array', NOW, true)
);

console.log('\nDone.');
NODE
