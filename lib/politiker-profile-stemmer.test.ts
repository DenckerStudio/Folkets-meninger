import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildPolitikerStemmerSummary,
  parseStortingetRepresentantVoteCode,
  representativeAlignsWithPollUsers,
  representativeVotedAgainstParty,
  type PolitikerStemmerRow,
} from '@/lib/politiker-profile-stemmer';
import { redactPublicPollTotals } from '@/lib/public-aggregate/poll-public-output';
import { publicAggregateMeetsThreshold } from '@/lib/public-aggregate/threshold';

test('parseStortingetRepresentantVoteCode maps for/mot/ikke_tilstede', () => {
  assert.equal(parseStortingetRepresentantVoteCode(1), 'for');
  assert.equal(parseStortingetRepresentantVoteCode(3), 'mot');
  assert.equal(parseStortingetRepresentantVoteCode(2), 'ikke_tilstede');
  assert.equal(parseStortingetRepresentantVoteCode(0), 'ikke_tilstede');
});

test('representativeVotedAgainstParty when rep breaks party line', () => {
  assert.equal(representativeVotedAgainstParty('for', 'mot'), true);
  assert.equal(representativeVotedAgainstParty('mot', 'for'), true);
  assert.equal(representativeVotedAgainstParty('for', 'for'), false);
  assert.equal(representativeVotedAgainstParty('ikke_tilstede', 'for'), false);
  assert.equal(representativeVotedAgainstParty('for', null), false);
});

test('representativeAlignsWithPollUsers ja/nei majority', () => {
  assert.equal(representativeAlignsWithPollUsers('for', 'ja'), true);
  assert.equal(representativeAlignsWithPollUsers('mot', 'nei'), true);
  assert.equal(representativeAlignsWithPollUsers('for', 'nei'), false);
  assert.equal(representativeAlignsWithPollUsers('mot', 'ja'), false);
});

test('redactPublicPollTotals hides counts under k<5', () => {
  const redacted = redactPublicPollTotals({ ja: 2, nei: 1, blank: 0, total: 3 });
  assert.equal(redacted.ja, null);
  assert.equal(redacted.nei, null);
  assert.equal(redacted.blank, null);
  assert.equal(redacted.total, 3);
  assert.equal(publicAggregateMeetsThreshold(redacted.total), false);
});

test('buildPolitikerStemmerSummary neutral when comparable is zero', () => {
  const summary = buildPolitikerStemmerSummary([]);
  assert.equal(summary.kind, 'neutral');
});

test('buildPolitikerStemmerSummary counts aligned rows only when k>=5', () => {
  const rows: PolitikerStemmerRow[] = [
    {
      issueId: '1',
      sakTitle: 'A',
      sakHref: '/dashboard/sak/1',
      voteringId: '10',
      voteringTema: 'Tema',
      votedAtIso: '2026-01-01',
      votedAtLabel: '1. jan. 2026',
      representantVote: 'for',
      partyLine: 'for',
      votedAgainstParty: false,
      poll: null,
      pollTotalsPublic: null,
      pollFylkeTotalsPublic: null,
      pollFylkeName: null,
      pollOpen: false,
      pollHref: null,
      comparableWithUsers: true,
      alignsWithUsers: true,
    },
    {
      issueId: '2',
      sakTitle: 'B',
      sakHref: '/dashboard/sak/2',
      voteringId: '11',
      voteringTema: 'Tema',
      votedAtIso: '2026-01-02',
      votedAtLabel: '2. jan. 2026',
      representantVote: 'mot',
      partyLine: 'mot',
      votedAgainstParty: false,
      poll: null,
      pollTotalsPublic: null,
      pollFylkeTotalsPublic: null,
      pollFylkeName: null,
      pollOpen: false,
      pollHref: null,
      comparableWithUsers: true,
      alignsWithUsers: false,
    },
    {
      issueId: '3',
      sakTitle: 'C',
      sakHref: '/dashboard/sak/3',
      voteringId: '12',
      voteringTema: 'Tema',
      votedAtIso: '2026-01-03',
      votedAtLabel: '3. jan. 2026',
      representantVote: 'mot',
      partyLine: 'for',
      votedAgainstParty: true,
      poll: null,
      pollTotalsPublic: null,
      pollFylkeTotalsPublic: null,
      pollFylkeName: null,
      pollOpen: false,
      pollHref: null,
      comparableWithUsers: false,
      alignsWithUsers: false,
    },
  ];

  const summary = buildPolitikerStemmerSummary(rows);
  assert.equal(summary.kind, 'stats');
  if (summary.kind !== 'stats') throw new Error('expected stats');
  assert.equal(summary.alignedCount, 1);
  assert.equal(summary.comparableCount, 2);
  assert.match(summary.message, /1 av 2/);
});