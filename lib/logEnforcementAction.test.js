const assert = require('node:assert');
const { logEnforcementAction } = require('./logEnforcementAction.js');

// Normal case
const result = logEnforcementAction({
  userId: 'user123',
  actionType: 'WARNING',
  targetId: 'target456',
  timestamp: '2024-01-01T00:00:00Z',
  metadata: { reason: 'test' }
});
assert.strictEqual(typeof result.entryId, 'string');
assert.strictEqual(result.entryId.length, 16);
assert.strictEqual(typeof result.hash, 'string');
assert.strictEqual(result.hash.length, 64);
assert.strictEqual(result.previousHash, '0000000000000000000000000000000000000000000000000000000000000000');
assert.deepStrictEqual(result.data, {
  userId: 'user123',
  actionType: 'WARNING',
  targetId: 'target456',
  timestamp: '2024-01-01T00:00:00Z',
  metadata: { reason: 'test' }
});
assert.strictEqual(typeof result.signed, 'string');
assert.strictEqual(result.signed.length, 64);

// Edge case: null action
assert.throws(() => logEnforcementAction(null), /Invalid action object/);

// Edge case: undefined action
assert.throws(() => logEnforcementAction(undefined), /Invalid action object/);

// Edge case: action is not an object
assert.throws(() => logEnforcementAction('string'), /Invalid action object/);

// Edge case: missing userId
assert.throws(() => logEnforcementAction({
  actionType: 'WARNING',
  targetId: 'target456',
  timestamp: '2024-01-01T00:00:00Z'
}), /Missing or invalid userId/);

// Edge case: invalid userId (number)
assert.throws(() => logEnforcementAction({
  userId: 123,
  actionType: 'WARNING',
  targetId: 'target456',
  timestamp: '2024-01-01T00:00:00Z'
}), /Missing or invalid userId/);

// Edge case: missing actionType
assert.throws(() => logEnforcementAction({
  userId: 'user123',
  targetId: 'target456',
  timestamp: '2024-01-01T00:00:00Z'
}), /Missing or invalid actionType/);

// Edge case: invalid actionType (not in valid list)
assert.throws(() => logEnforcementAction({
  userId: 'user123',
  actionType: 'INVALID',
  targetId: 'target456',
  timestamp: '2024-01-01T00:00:00Z'
}), /Invalid actionType/);

// Edge case: missing targetId
assert.throws(() => logEnforcementAction({
  userId: 'user123',
  actionType: 'WARNING',
  timestamp: '2024-01-01T00:00:00Z'
}), /Missing or invalid targetId/);

// Edge case: invalid targetId (boolean)
assert.throws(() => logEnforcementAction({
  userId: 'user123',
  actionType: 'WARNING',
  targetId: true,
  timestamp: '2024-01-01T00:00:00Z'
}), /Missing or invalid targetId/);

// Edge case: missing timestamp
assert.throws(() => logEnforcementAction({
  userId: 'user123',
  actionType: 'WARNING',
  targetId: 'target456'
}), /Missing or invalid timestamp/);

// Edge case: invalid timestamp (object)
assert.throws(() => logEnforcementAction({
  userId: 'user123',
  actionType: 'WARNING',
  targetId: 'target456',
  timestamp: {}
}), /Missing or invalid timestamp/);

// Edge case: metadata is undefined (should default to {})
const resultNoMeta = logEnforcementAction({
  userId: 'user123',
  actionType: 'FINE',
  targetId: 'target456',
  timestamp: '2024-01-01T00:00:00Z'
});
assert.deepStrictEqual(resultNoMeta.data.metadata, {});

// Edge case: all valid action types
['WARNING', 'FINE', 'SUSPENSION', 'REVOCATION', 'NOTICE'].forEach(type => {
  const res = logEnforcementAction({
    userId: 'user123',
    actionType: type,
    targetId: 'target456',
    timestamp: '2024-01-01T00:00:00Z'
  });
  assert.strictEqual(res.data.actionType, type);
});

console.log('ok');