import assert from 'node:assert/strict';
import { parseFolkTotals, shapeVoteAlignment } from './vote-alignment';
import type { AlignmentComparison } from '@/lib/alignment/types';

async function main() {
  assert.deepEqual(parseFolkTotals(null), { for: 0, against: 0, abstain: 0, total: 0 });
  assert.deepEqual(parseFolkTotals({ for: 3, against: 1, abstain: 1 }), {
    for: 3,
    against: 1,
    abstain: 1,
    total: 5,
  });
  assert.deepEqual(parseFolkTotals({ for: 2, against: 0, abstain: 0, total: 2 }), {
    for: 2,
    against: 0,
    abstain: 0,
    total: 2,
  });
  assert.deepEqual(parseFolkTotals({ for: -1, against: 'x' }), {
    for: 0,
    against: 0,
    abstain: 0,
    total: 0,
  });

  const comparison: AlignmentComparison = {
    folk: { for: 7, against: 3, abstain: 0, total: 10 },
    folkForPercent: 70,
    folkAgainstPercent: 30,
    folkAbstainPercent: 0,
    folkSide: 'for',
    stortinget: { for: 60, against: 40, absent: 1, decided: 100, adopted: true },
    stortingetForPercent: 60,
    stortingetAgainstPercent: 40,
    stortingetSide: 'for',
    score: 90,
    gapPoints: 10,
    verdict: 'aligned',
    headline: 'Tekst med For og Mot.',
    summary: 'Sammendrag.',
    votering: { votering_id: 1, votering_tema: 'Innstillingen' },
    otherVoteringCount: 2,
  };

  const shaped = shapeVoteAlignment(comparison);
  assert.equal(shaped.hasStortingetVote, true);
  assert.equal(shaped.score, 90);
  assert.equal(shaped.gapPoints, 10);
  assert.equal(shaped.voteringTema, 'Innstillingen');
  assert.equal(shaped.otherVoteringCount, 2);
  assert.equal(shaped.folkForPercent, 70);
  assert.equal(shaped.stortingetForPercent, 60);
  assert.equal(shaped.stortinget?.adopted, true);

  const pending = shapeVoteAlignment({
    ...comparison,
    stortinget: null,
    stortingetForPercent: null,
    stortingetAgainstPercent: null,
    stortingetSide: null,
    votering: null,
    score: null,
    gapPoints: null,
    verdict: 'pending',
    otherVoteringCount: 0,
  });
  assert.equal(pending.hasStortingetVote, false);
  assert.equal(pending.voteringTema, null);
  assert.equal(pending.score, null);

  console.log('chat/vote-alignment.test.ts: ok');
}

void main();
