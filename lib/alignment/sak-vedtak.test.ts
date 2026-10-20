import assert from 'node:assert/strict';
import {
  formatStortingetVoteringTall,
  resolveSakProposalAdopted,
} from './sak-vedtak';

assert.equal(resolveSakProposalAdopted('Forslaget ble ikke vedtatt.'), false);
assert.equal(resolveSakProposalAdopted('Forslaget ble vedtatt.'), true);
assert.equal(resolveSakProposalAdopted(null), null);
assert.equal(
  formatStortingetVoteringTall(79, 21),
  'Voteringen: 79 % For, 21 % Mot',
);

console.log('sak-vedtak tests passed');
