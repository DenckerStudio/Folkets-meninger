import assert from 'node:assert/strict';
import { buildCounterProposalPackage, canPackageCounterProposal, counterProposalPackageToMarkdown } from './package';
import { COUNTER_PROPOSAL_PACKAGE_DISCLAIMER } from './types';

const proposal = {
  id: '11111111-1111-1111-1111-111111111111',
  stortingetIssueId: '200211',
  authorUserId: 'user-1',
  authorName: 'Kari Nordmann',
  title: 'Reduser avgiften for pendlerne',
  body: 'Vi foreslår en målrettet kompensasjon for pendlere i distriktene, finansiert innenfor eksisterende ramme.',
  status: 'threshold_met' as const,
  supportThreshold: 10,
  supportCount: 12,
  stortingetHearingId: '10001',
  hearingDeadlineAt: '2026-09-01T12:00:00.000Z',
  packagedAt: null,
  createdAt: '2026-08-22T10:00:00.000Z',
};

assert.equal(canPackageCounterProposal(proposal), true);
assert.equal(canPackageCounterProposal({ ...proposal, supportCount: 3 }), false);
assert.equal(canPackageCounterProposal({ ...proposal, status: 'withdrawn' }), false);

const pkg = buildCounterProposalPackage({
  proposal,
  sakTitle: 'Endringer i klimakvoteloven',
  hearing: {
    id: '10001',
    title: 'Høring om klimaavgifter',
    komite: 'Energi- og miljøkomiteen',
    deadlineAt: '2026-09-01T12:00:00.000Z',
  },
  generatedAt: '2026-08-22T11:00:00.000Z',
});

assert.equal(pkg.kind, 'motforslag_horingsinnspill');
assert.equal(pkg.disclaimer, COUNTER_PROPOSAL_PACKAGE_DISCLAIMER);
assert.equal(pkg.proposal.supportCount, 12);

const markdown = counterProposalPackageToMarkdown(pkg);
assert.match(markdown, /Reduser avgiften for pendlerne/);
assert.match(markdown, /ikke sendt inn via et Stortinget-API/);
assert.match(markdown, /Energi- og miljøkomiteen/);

console.log('counter-proposal package tests passed');
