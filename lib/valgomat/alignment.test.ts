import assert from 'node:assert/strict';
import {
  buildValgomatPartySummaries,
  userAlignsWithPartyVote,
  VALGOMAT_MIN_PERCENT_COMPARABLE,
  VALGOMAT_SMALL_SAMPLE_COMPARABLE,
  type EngagedUserStance,
} from '@/lib/valgomat/alignment';

assert.equal(userAlignsWithPartyVote('enig', 'for'), true);
assert.equal(userAlignsWithPartyVote('uenig', 'mot'), true);
assert.equal(userAlignsWithPartyVote('enig', 'mot'), false);
assert.equal(userAlignsWithPartyVote('uenig', 'for'), false);

const engaged: EngagedUserStance[] = [
  {
    stortinget_issue_id: '100',
    title: 'Sak A',
    stance: 'enig',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    stortinget_issue_id: '200',
    title: 'Sak B',
    stance: 'uenig',
    updated_at: '2026-01-02T00:00:00Z',
  },
  {
    stortinget_issue_id: '300',
    title: 'Sak uten votering',
    stance: 'enig',
    updated_at: '2026-01-03T00:00:00Z',
  },
];

const sakVotes = [
  {
    stortinget_issue_id: '100',
    votering_tema: 'Hovedvotering',
    party_stances: { A: 'for' as const, H: 'mot' as const },
  },
  {
    stortinget_issue_id: '200',
    votering_tema: 'Alternativ',
    party_stances: { A: 'for' as const, H: 'mot' as const },
  },
];

const summaries = buildValgomatPartySummaries(engaged, sakVotes);
assert.equal(summaries.length, 2);

const ap = summaries.find((s) => s.party_code === 'A');
assert.ok(ap);
assert.equal(ap.comparable, 2);
assert.equal(ap.matching, 1);
assert.equal(ap.agreement_percent, null);

const hoeyre = summaries.find((s) => s.party_code === 'H');
assert.ok(hoeyre);
assert.equal(hoeyre.matching, 1);
assert.equal(hoeyre.comparable, 2);
assert.equal(hoeyre.agreement_percent, null);

const manyIssues: EngagedUserStance[] = Array.from({ length: 5 }, (_, i) => ({
  stortinget_issue_id: String(1000 + i),
  title: `Sak ${i}`,
  stance: i % 2 === 0 ? 'enig' : 'uenig',
  updated_at: `2026-01-0${i + 1}T00:00:00Z`,
}));

const manyVotes = manyIssues.map((row, i) => ({
  stortinget_issue_id: row.stortinget_issue_id,
  votering_tema: 'Tema',
  party_stances: {
    SV: i % 2 === 0 ? ('for' as const) : ('mot' as const),
  },
}));

const svSummary = buildValgomatPartySummaries(manyIssues, manyVotes)[0];
assert.equal(svSummary.party_code, 'SV');
assert.equal(svSummary.comparable, 5);
assert.equal(svSummary.matching, 5);
assert.equal(svSummary.agreement_percent, 100);
assert.equal(svSummary.small_sample, false);

const twoIssues = manyIssues.slice(0, 2);
const twoVotes = manyVotes.slice(0, 2);
const small = buildValgomatPartySummaries(twoIssues, twoVotes)[0];
assert.equal(small.comparable, 2);
assert.equal(small.agreement_percent, null);
assert.equal(small.small_sample, true);
assert.equal(VALGOMAT_MIN_PERCENT_COMPARABLE, 3);
assert.equal(VALGOMAT_SMALL_SAMPLE_COMPARABLE, 5);

console.log('valgomat alignment tests passed');