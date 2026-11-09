import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildResearchTopicBlogDraftInput,
  researchTopicBlogSourceEvent,
  researchTopicBlogSourceEventPrefix,
} from '@/lib/admin/research/topic-blog-draft';

const builderSrc = readFileSync(
  join(process.cwd(), 'lib/admin/research/topic-blog-draft.ts'),
  'utf8',
);
assert.doesNotMatch(builderSrc, /rawTopicTitle/);
assert.doesNotMatch(builderSrc, /topic\.title/);
assert.match(builderSrc, /buildResearchTopicBlogDraftInput\(args: \{[\s\S]*?requestId: string;[\s\S]*?output: unknown;/);
assert.doesNotMatch(builderSrc, /buildResearchTopicBlogDraftInput\(args: \{[\s\S]*?title:/);

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

const built = buildResearchTopicBlogDraftInput({
  requestId,
  output: baseOutput,
});

assert.equal(built.ok, true);
if (built.ok) {
  assert.equal(built.input.title, 'Formueskatt i kommunene');
  assert.equal(
    built.input.source_event,
    researchTopicBlogSourceEvent(requestId),
  );
  assert.equal(researchTopicBlogSourceEventPrefix(requestId), `research_topic:${requestId}`);
  assert.match(built.input.body_md, /## Kilder/);
  assert.match(built.input.body_md, /\[A\].*NRK/);
  assert.doesNotMatch(built.input.body_md, /reddit\.com/i);
  assert.doesNotMatch(built.input.body_md, /Reddit-tråd/);
}

const missingBriefTitle = buildResearchTopicBlogDraftInput({
  requestId,
  output: { ...baseOutput, topic_title: undefined },
});
assert.equal(missingBriefTitle.ok, false);
if (!missingBriefTitle.ok) {
  assert.equal(missingBriefTitle.error, 'Briefen mangler tittel');
  assert.doesNotMatch(missingBriefTitle.error, /topic_title/i);
}

const variant = buildResearchTopicBlogDraftInput({
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
