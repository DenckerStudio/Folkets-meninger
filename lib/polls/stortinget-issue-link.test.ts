import assert from 'node:assert/strict';
import { researchTopicDedicatedIssueId } from '@/lib/sak/research-topic-dedicated-issue';
import { pollPublicStortingetIssueId, pollSakDashboardHref } from '@/lib/polls/stortinget-issue-link';

const dedicated = researchTopicDedicatedIssueId('b6e34015-5e6f-409a-980c-cdfc97e7a4d0');

assert.equal(pollPublicStortingetIssueId(dedicated), null, 'dedicated issue hidden from links');
assert.equal(pollPublicStortingetIssueId(' 103102 '), '103102', 'trim public id');
assert.equal(pollSakDashboardHref(dedicated), null, 'no href for dedicated');
assert.equal(
  pollSakDashboardHref('103102'),
  '/dashboard/sak/103102',
  'dashboard sak href',
);

console.log('lib/polls/stortinget-issue-link.test.ts: ok');