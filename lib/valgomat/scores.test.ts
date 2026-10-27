import assert from 'node:assert/strict';
import { PARTY_ALIGNMENT_AVAILABLE, stanceCountFromRpc } from './scores';

assert.equal(PARTY_ALIGNMENT_AVAILABLE, false);

assert.equal(stanceCountFromRpc(0), 0);
assert.equal(stanceCountFromRpc(3), 3);
assert.equal(stanceCountFromRpc(null), 0);

console.log('valgomat scores tests passed');
