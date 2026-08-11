function logEnforcementAction(action) {
  const validActionTypes = ['WARNING', 'FINE', 'SUSPENSION', 'REVOCATION', 'NOTICE'];
  if (!action || typeof action !== 'object') throw new Error('Invalid action object');
  const { userId, actionType, targetId, timestamp, metadata } = action;
  if (!userId || typeof userId !== 'string') throw new Error('Missing or invalid userId');
  if (!actionType || typeof actionType !== 'string') throw new Error('Missing or invalid actionType');
  if (!validActionTypes.includes(actionType)) throw new Error('Invalid actionType');
  if (!targetId || typeof targetId !== 'string') throw new Error('Missing or invalid targetId');
  if (!timestamp || typeof timestamp !== 'string') throw new Error('Missing or invalid timestamp');
  const crypto = require('crypto');
  const previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
  const data = { userId, actionType, targetId, timestamp, metadata: metadata || {} };
  const hashInput = previousHash + JSON.stringify(data) + timestamp;
  const hash = crypto.createHash('sha256').update(hashInput).digest('hex');
  const entryId = hash.substring(0, 16);
  const signed = crypto.createHash('sha256').update(hash + 'COMPLIANCE_KEY').digest('hex');
  return { entryId, hash, previousHash, data, signed };
}
module.exports = { logEnforcementAction };