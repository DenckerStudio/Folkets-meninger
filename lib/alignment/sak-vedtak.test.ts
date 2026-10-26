import assert from 'node:assert/strict';
import {
  classifyStortingetVoteSubject,
  formatInnstillingVoteTall,
  formatQuotedKortvedtak,
  isInnstillingVoteCase,
  joinStortingetHeadline,
  resolveSakProposalAdopted,
  stortingetForShareForFolkAlignment,
} from './sak-vedtak';

assert.equal(resolveSakProposalAdopted('Forslaget ble ikke vedtatt.'), false);
assert.equal(resolveSakProposalAdopted('Forslaget ble vedtatt.'), true);
assert.equal(resolveSakProposalAdopted(null), null);
assert.equal(
  resolveSakProposalAdopted('Innstillingen ble vedtatt. Forslaget ble ikke vedtatt.'),
  false,
);
assert.equal(
  resolveSakProposalAdopted('Forslaget ble ikke vedtatt. Innstillingen ble vedtatt.'),
  false,
);
assert.equal(resolveSakProposalAdopted('Innstillingen ble vedtatt.'), null);
assert.equal(resolveSakProposalAdopted('Tilrådingen ble vedtatt.'), null);
assert.equal(
  resolveSakProposalAdopted(null, 'Vedtak i samsvar med innstillingen'),
  null,
);

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

assert.equal(
  isInnstillingVoteCase({
    kortvedtak: 'Forslaget ble ikke vedtatt.',
    votering: { votering_id: 1, vedtatt: true },
  }),
  true,
);
assert.equal(
  isInnstillingVoteCase({
    kortvedtak: 'Forslaget ble ikke vedtatt.',
    votering: { votering_id: 1, vedtatt: false },
  }),
  false,
);

assert.equal(
  stortingetForShareForFolkAlignment({
    stFor: 30,
    stAgainst: 70,
    stDecided: 100,
    hasElectronicCounts: true,
    proposalAdopted: false,
    innstillingVote: false,
  }),
  0.3,
);
assert.equal(
  stortingetForShareForFolkAlignment({
    stFor: 79,
    stAgainst: 21,
    stDecided: 100,
    hasElectronicCounts: true,
    proposalAdopted: false,
    innstillingVote: true,
  }),
  0.21,
);

assert.equal(formatQuotedKortvedtak('Forslaget ble ikke vedtatt.'), '«Forslaget ble ikke vedtatt»');
assert.equal(
  joinStortingetHeadline('«Forslaget ble ikke vedtatt»', '79 % stemte for innstillingen, 21 % mot'),
  '«Forslaget ble ikke vedtatt» — 79 % stemte for innstillingen, 21 % mot.',
);
assert.doesNotMatch(
  joinStortingetHeadline('«Forslaget ble ikke vedtatt»', '79 % stemte for innstillingen, 21 % mot'),
  /\.\./,
);

console.log('sak-vedtak tests passed');
