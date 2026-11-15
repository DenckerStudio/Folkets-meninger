import assert from 'node:assert/strict';
import { buildAlignmentComparison } from '@/lib/alignment/score';
import type { SakVotering } from '@/lib/alignment/types';
import {
  publicFolkPercentsNullable,
  redactPublicFolkChoiceFields,
  redactPublicFolkForTool,
} from '@/lib/public-aggregate/folk-public-output';
import { shapeVoteAlignment, type VoteAlignmentResult } from '@/lib/chat/vote-alignment';

const votering: SakVotering = {
  votering_id: 1,
  vedtatt: true,
  antall_for: 60,
  antall_mot: 40,
  personlig_votering: true,
};

const pendingFew = buildAlignmentComparison({ for: 3, against: 1, abstain: 0, total: 4 }, []);
assert.equal(pendingFew.verdict, 'pending');
assert.doesNotMatch(pendingFew.headline, /%/);
assert.match(pendingFew.headline, /ikke votert/i);

const redactedFields = redactPublicFolkChoiceFields({ for: 2, against: 1, abstain: 0, total: 3 });
assert.equal(redactedFields.for, null);
assert.equal(redactedFields.against, null);
assert.equal(redactedFields.total, 3);

const publicTotals = redactPublicFolkChoiceFields({ for: 10, against: 2, abstain: 1, total: 13 });
assert.equal(publicTotals.for, 10);
assert.equal(publicTotals.abstain, 1);

const percents = publicFolkPercentsNullable({ for: 1, against: 1, abstain: 0, total: 2 });
assert.equal(percents.folkForPercent, null);
assert.equal(percents.folkAgainstPercent, null);

const insufficient = buildAlignmentComparison({ for: 2, against: 1, abstain: 0, total: 3 }, [votering]);
const toolShaped: VoteAlignmentResult = shapeVoteAlignment(insufficient);
const toolPublic = redactPublicFolkForTool(toolShaped);
assert.equal(toolPublic.folkForPercent, null);
assert.equal(toolPublic.folkAgainstPercent, null);
assert.equal(toolPublic.folk.for, null);
assert.equal(toolPublic.folk.against, null);
assert.equal(toolPublic.folk.abstain, null);
assert.equal(toolPublic.folk.total, 3);
assert.equal(toolPublic.belowPublicThreshold, true);
assert.match(toolPublic.folkBreakdownNote ?? '', /Oppgi ingen/);

const rscPayload = redactPublicFolkChoiceFields({ for: 4, against: 0, abstain: 0, total: 4 });
assert.equal(rscPayload.for, null);
assert.equal(rscPayload.total, 4);

const zeroPayload = redactPublicFolkChoiceFields({ for: 0, against: 0, abstain: 0, total: 0 });
assert.equal(zeroPayload.for, 0);
assert.equal(zeroPayload.against, 0);

const zeroTool = redactPublicFolkForTool({
  ...toolPublic,
  folk: { for: 0, against: 0, abstain: 0, total: 0 },
});
assert.equal(zeroTool.belowPublicThreshold, false);
assert.equal(zeroTool.folkBreakdownNote, null);

console.log('lib/public-aggregate/folk-public-output.test.ts: ok');