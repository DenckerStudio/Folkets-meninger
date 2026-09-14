import assert from 'node:assert/strict';
import {
  PARTY_ALIGNMENT_AVAILABLE,
  stanceCountFromRpc,
  voteCountFromHistoryRpc,
} from './scores';

assert.equal(PARTY_ALIGNMENT_AVAILABLE, false);

assert.equal(stanceCountFromRpc(0), 0);
assert.equal(stanceCountFromRpc(3), 3);
assert.equal(stanceCountFromRpc(null), 0);

assert.equal(voteCountFromHistoryRpc([]), 0);
assert.equal(voteCountFromHistoryRpc([{ stortinget_issue_id: '1' }]), 1);
assert.equal(voteCountFromHistoryRpc([{ id: '1' }, { id: '2' }]), 2);
assert.equal(voteCountFromHistoryRpc(null), 0);
assert.equal(voteCountFromHistoryRpc({}), 0);

console.log('valgomat scores tests passed');
