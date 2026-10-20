import assert from 'node:assert/strict';
import {
  classifyStortingetVoteSubject,
  formatInnstillingVoteTall,
  resolveSakProposalAdopted,
} from './sak-vedtak';

assert.equal(resolveSakProposalAdopted('Forslaget ble ikke vedtatt.'), false);
assert.equal(resolveSakProposalAdopted('Forslaget ble vedtatt.'), true);
assert.equal(resolveSakProposalAdopted(null), null);
assert.equal(
  formatInnstillingVoteTall(79, 21),
  '79 % stemte for innstillingen, 21 % mot',
);
assert.equal(
  classifyStortingetVoteSubject({
    kortvedtak: 'Forslaget ble ikke vedtatt.',
    vedtakstekst: 'Vedtak i samsvar med innstillingen',
    votering: { votering_id: 1, vedtatt: true, antall_for: 79, antall_mot: 21 },
    hasElectronicCounts: true,
  }),
  'innstilling',
);

console.log('sak-vedtak tests passed');
