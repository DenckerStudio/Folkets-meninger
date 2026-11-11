import assert from 'node:assert/strict';
import {
  DEV_TASK_PROPOSAL_CARD_ID_PREFIX,
  devTaskProposalCardDomId,
  isHttpOrHttpsUrl,
  parseDevTaskProposalIdFromHash,
} from '@/lib/admin/dev-task-proposals/hash-anchor';

const sampleId = '123e4567-e89b-12d3-a456-426614174000';

assert.equal(devTaskProposalCardDomId(sampleId), `${DEV_TASK_PROPOSAL_CARD_ID_PREFIX}${sampleId}`);

assert.equal(
  parseDevTaskProposalIdFromHash(`#${DEV_TASK_PROPOSAL_CARD_ID_PREFIX}${sampleId}`),
  sampleId,
);
assert.equal(parseDevTaskProposalIdFromHash(`${DEV_TASK_PROPOSAL_CARD_ID_PREFIX}${sampleId}`), sampleId);
assert.equal(parseDevTaskProposalIdFromHash(''), null);
assert.equal(parseDevTaskProposalIdFromHash('#other'), null);
assert.equal(parseDevTaskProposalIdFromHash(`#${DEV_TASK_PROPOSAL_CARD_ID_PREFIX}`), null);

assert.equal(isHttpOrHttpsUrl('https://slack.com/archives/C123/p456'), true);
assert.equal(isHttpOrHttpsUrl('http://example.test/ref'), true);
assert.equal(isHttpOrHttpsUrl('slack:channel'), false);
assert.equal(isHttpOrHttpsUrl('not a url'), false);

console.log('dev-task-proposals/hash-anchor.test.ts: ok');
