import assert from 'node:assert/strict';
import {
  normalizeDashboardSakRouteId,
  parseResearchTopicIdFromDedicatedSakId,
  researchTopicDedicatedIssueId,
} from '@/lib/sak/research-topic-dedicated-issue';

const topicId = 'b6e34015-5e6f-409a-980c-cdfc97e7a4d0';
const dedicated = researchTopicDedicatedIssueId(topicId);

assert.equal(parseResearchTopicIdFromDedicatedSakId(dedicated), topicId);
assert.equal(
  normalizeDashboardSakRouteId(encodeURIComponent(dedicated)),
  dedicated,
  'route param dekodes',
);

console.log('lib/sak/dedicated-research-topic-id.test.ts: ok');