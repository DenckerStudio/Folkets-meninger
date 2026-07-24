import assert from 'node:assert/strict';
import {
  PARTY_ALIGNMENT_AVAILABLE,
  voteCountFromHistory,
} from './scores';

assert.equal(PARTY_ALIGNMENT_AVAILABLE, false);

assert.equal(voteCountFromHistory([]), 0);
assert.equal(voteCountFromHistory([{ prompt_id: '1' }]), 1);
assert.equal(voteCountFromHistory([{ id: '1' }, { id: '2' }]), 2);
assert.equal(voteCountFromHistory(null), 0);
assert.equal(voteCountFromHistory({}), 0);

console.log('valgomat scores tests passed');
