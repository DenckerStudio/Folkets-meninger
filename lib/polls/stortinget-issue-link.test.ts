import assert from 'node:assert/strict';
import { researchTopicDedicatedIssueId } from '@/lib/sak/research-topic-dedicated-issue';
import {
  dedicatedResearchTopicSakHref,
  resolvePollSourceSakLink,
} from '@/lib/polls/stortinget-issue-link';

const topicId = 'b6e34015-5e6f-409a-980c-cdfc97e7a4d0';
const dedicated = researchTopicDedicatedIssueId(topicId);

const dedicatedLink = resolvePollSourceSakLink(dedicated);
assert.ok(dedicatedLink);
assert.equal(dedicatedLink.kind, 'dedicated');
assert.equal(
  dedicatedLink.href,
  dedicatedResearchTopicSakHref(dedicated),
  'dedikert temasak lenkes med encodeURIComponent',
);

assert.equal(
  resolvePollSourceSakLink('103102')?.href,
  '/dashboard/sak/103102',
  'ekte Stortinget-sak',
);

const temaFallback = resolvePollSourceSakLink(null, { researchTopicId: topicId });
assert.equal(temaFallback?.kind, 'research-topic');
assert.equal(temaFallback?.href, `/dette-snakkes-det-om/${encodeURIComponent(topicId)}`);

console.log('lib/polls/stortinget-issue-link.test.ts: ok');