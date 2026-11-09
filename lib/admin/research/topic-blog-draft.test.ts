import assert from 'node:assert/strict';
import {
  buildResearchTopicBlogDraftInput,
  researchTopicBlogSourceEvent,
} from '@/lib/admin/research/topic-blog-draft';

const baseOutput = {
  topic_title: 'Formueskatt i kommunene',
  current_rules: { items: ['Eksisterende regelverk'], note: 'ok' },
  party_proposals: { items: [], note: 'ingen funnet' },
  media_coverage: { items: [], note: 'ingen funnet' },
  polls: { items: [], note: 'ingen funnet' },
  sources: {
    items: [
      {
        id: 'nrk',
        title: 'NRK om formueskatt',
        url: 'https://www.nrk.no/sak',
        publisher: 'nrk.no',
        grade: 'A',
      },
      {
        id: 'reddit',
        title: 'Reddit-tråd',
        url: 'https://www.reddit.com/r/norge/comments/abc/test/',
        publisher: 'reddit.com',
        grade: 'D',
      },
    ],
    note: 'ok',
  },
  generated_at: '2026-11-03T12:00:00.000Z',
};

const requestId = '00000000-0000-4000-8000-000000000099';

const withRawRedditTitle = buildResearchTopicBlogDraftInput({
  topicId: '00000000-0000-4000-8000-000000000001',
  requestId,
  output: baseOutput,
  rawTopicTitle: 'Rå Reddit-tittel som aldri skal brukes',
});

assert.equal(withRawRedditTitle.ok, true);
if (withRawRedditTitle.ok) {
  assert.equal(withRawRedditTitle.input.title, 'Formueskatt i kommunene');
  assert.notEqual(withRawRedditTitle.input.title, 'Rå Reddit-tittel som aldri skal brukes');
  assert.equal(
    withRawRedditTitle.input.source_event,
    researchTopicBlogSourceEvent(requestId),
  );
  assert.match(withRawRedditTitle.input.body_md, /## Kilder/);
  assert.match(withRawRedditTitle.input.body_md, /\[A\].*NRK/);
  assert.doesNotMatch(withRawRedditTitle.input.body_md, /reddit\.com/i);
  assert.doesNotMatch(withRawRedditTitle.input.body_md, /Reddit-tråd/);
}

const missingBriefTitle = buildResearchTopicBlogDraftInput({
  topicId: '00000000-0000-4000-8000-000000000001',
  requestId,
  output: { ...baseOutput, topic_title: undefined },
  rawTopicTitle: 'Skulle ikke brukes',
});
assert.equal(missingBriefTitle.ok, false);

const variant = buildResearchTopicBlogDraftInput({
  topicId: '00000000-0000-4000-8000-000000000001',
  requestId,
  output: baseOutput,
  variantId: '11111111-1111-4111-8111-111111111111',
});
assert.equal(variant.ok, true);
if (variant.ok) {
  assert.match(variant.input.slug, /11111111$/);
  assert.equal(
    variant.input.source_event,
    researchTopicBlogSourceEvent(requestId, '11111111-1111-4111-8111-111111111111'),
  );
}

console.log('lib/admin/research/topic-blog-draft.test.ts: ok');
