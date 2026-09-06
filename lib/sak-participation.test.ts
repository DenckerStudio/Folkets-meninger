import assert from 'node:assert/strict';
import {
  buildParticipationSummary,
  motforslagCtaForVote,
  participationStepLabel,
} from './sak-participation';

const summary = buildParticipationSummary(
  [
    {
      id: 'p1',
      stortingetIssueId: '123',
      authorUserId: 'u1',
      authorName: 'Ola',
      title: 'Alternativ A',
      body: 'body',
      status: 'gathering',
      supportThreshold: 10,
      supportCount: 3,
      stortingetHearingId: null,
      hearingDeadlineAt: null,
      packagedAt: null,
      createdAt: '2026-01-01',
    },
  ],
  { id: 'h1', title: 'Høring om saken', open: true },
);

assert.equal(summary.proposalCount, 1);
assert.equal(summary.topProposal?.title, 'Alternativ A');
assert.equal(summary.hearingOpen, true);

assert.equal(participationStepLabel('vote'), 'Stem');
assert.match(motforslagCtaForVote('against'), /alternativ/i);
assert.match(motforslagCtaForVote(null), /Utforsk motforslag/i);

console.log('sak-participation.test.ts: ok');
