import assert from 'node:assert/strict';
import type { OppfangetRedditRow } from '@/lib/admin/oppfanget/types';
import { redditRelatedIssueLinkLabel } from '@/lib/reddit-signals/format';

const base: OppfangetRedditRow = {
  rowKind: 'reddit',
  id: 'id',
  title: 'Tråd',
  displayType: 'reddit',
  firstSeenAt: '2026-11-02T10:00:00+00:00',
  lastSeenAt: '2026-11-02T11:00:00+00:00',
  subreddit: 'norge',
  redditId: 'abc',
  url: 'https://www.reddit.com/comments/abc/',
  score: 1,
  numComments: 2,
  contention: 2,
  postedAt: '2026-11-02T10:00:00+00:00',
  snapshotAt: '2026-11-02T11:00:00+00:00',
  topic: null,
  relatedIssueId: '12345',
  relatedIssueTitle: '  Lov om noe  ',
  relatedSimilarity: null,
};

assert.equal(redditRelatedIssueLinkLabel(base), 'Lov om noe');
assert.equal(
  redditRelatedIssueLinkLabel({ ...base, relatedIssueTitle: null }),
  'Sak 12345',
);
assert.equal(
  redditRelatedIssueLinkLabel({ ...base, relatedIssueId: null, relatedIssueTitle: null }),
  '',
);

console.log('lib/reddit-signals/format.test.ts: ok');
