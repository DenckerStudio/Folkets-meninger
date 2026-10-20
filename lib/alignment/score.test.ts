import assert from 'node:assert/strict';
import { alignmentScore, buildAlignmentComparison } from './score';
import type { SakVotering } from './types';

assert.equal(alignmentScore(0.78, 0.7, true), 92);
assert.ok(alignmentScore(0.78, 0.45, false) < 40);

const folk = { for: 78, against: 18, abstain: 4, total: 100 };
const votering: SakVotering = {
  votering_id: 10,
  votering_tema: 'Innstillingen',
  vedtatt: false,
  antall_for: 45,
  antall_mot: 55,
  antall_ikke_tilstede: 69,
  personlig_votering: true,
};

const comparison = buildAlignmentComparison(folk, [votering]);
assert.equal(comparison.verdict, 'divergent');
assert.equal(comparison.folkForPercent, 78);
assert.equal(comparison.stortingetAgainstPercent, 55);
assert.match(comparison.headline, /78 % av brukerne stemte For/);
assert.match(comparison.headline, /nedstemte/);
assert.match(comparison.headline, /55 % Mot/);
assert.ok(comparison.score != null && comparison.score < 40);

const pending = buildAlignmentComparison(folk, []);
assert.equal(pending.verdict, 'pending');
assert.match(pending.headline, /ikke votert/);

const few = buildAlignmentComparison({ for: 2, against: 1, abstain: 0, total: 3 }, [votering]);
assert.equal(few.verdict, 'insufficient');
assert.ok(few.score == null);

const noButtons = buildAlignmentComparison(folk, [
  {
    votering_id: 28430,
    vedtatt: true,
    antall_for: -1,
    antall_mot: -1,
    personlig_votering: false,
    votering_tema: 'Redegjørelse',
  },
]);
assert.equal(noButtons.stortingetForPercent, null);
assert.match(noButtons.headline, /uten elektronisk personlig votering/);
assert.equal(noButtons.stortinget?.adopted, true);

const aligned = buildAlignmentComparison(
  { for: 70, against: 20, abstain: 10, total: 100 },
  [
    {
      votering_id: 11,
      vedtatt: true,
      antall_for: 80,
      antall_mot: 20,
      personlig_votering: true,
      votering_tema: 'Innstillingen',
    },
  ],
);
assert.equal(aligned.verdict, 'aligned');
assert.ok((aligned.score ?? 0) >= 70);

const innstillingRejected = buildAlignmentComparison(
  { for: 10, against: 5, abstain: 0, total: 15 },
  [
    {
      votering_id: 200148,
      votering_tema: 'Innstillingen',
      vedtatt: true,
      antall_for: 79,
      antall_mot: 21,
      personlig_votering: true,
    },
  ],
  { kortvedtak: 'Forslaget ble ikke vedtatt.' },
);
assert.match(innstillingRejected.headline, /Forslaget ble ikke vedtatt/);
assert.match(innstillingRejected.headline, /79 % stemte for innstillingen, 21 % mot/);
assert.doesNotMatch(innstillingRejected.headline, /vedtok forslaget/i);
assert.doesNotMatch(innstillingRejected.headline, /Voteringen: 79 % For/i);
assert.equal(innstillingRejected.stortinget?.adopted, false);
assert.equal(innstillingRejected.stortingetBarLabels.for, 'For innstillingen');
assert.equal(innstillingRejected.stortingetBarLabels.against, 'Mot innstillingen');

console.log('alignment score tests passed');
