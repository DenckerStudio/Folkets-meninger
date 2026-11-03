import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildResearchTopicBriefViewModel,
  filterPublishableSources,
  isUnpublishableSourceHost,
  researchTopicBriefOutputSchema,
  researchTopicHasOpenableBrief,
} from '@/lib/admin/research/topic-brief-schema';
import { resolveResearchTopicSourceKey } from '@/lib/admin/research/topic-service';

assert.equal(isUnpublishableSourceHost('https://www.reddit.com/r/norge/x'), true);
assert.equal(isUnpublishableSourceHost('https://www.nrk.no/sak'), false);

const sampleOutput = {
  topic_title: 'Formueskatt',
  current_rules: { items: ['Regel'], note: 'ok' },
  party_proposals: { items: [], note: 'ingen funnet' },
  media_coverage: { items: [], note: 'ingen funnet' },
  polls: { items: [], note: 'ingen funnet' },
  sources: {
    items: [
      {
        id: 's1',
        title: 'NRK',
        url: 'https://www.nrk.no/sak',
        publisher: 'nrk.no',
        grade: 'A',
      },
    ],
    note: 'ok',
  },
};

assert.ok(researchTopicBriefOutputSchema.safeParse(sampleOutput).success);

const view = buildResearchTopicBriefViewModel({
  output: sampleOutput,
  publishable: false,
  blockingReason: 'Test',
  rawTitle: 'Rå tittel fra Reddit',
  status: 'done',
  redditSubreddit: 'norge',
});
assert.ok(view);
assert.equal(view?.displayTitle, 'Formueskatt');
assert.equal(view?.showUnpublishableNotice, true);

const redditOnly = filterPublishableSources([
  {
    id: 'r1',
    title: 'X',
    url: 'https://www.reddit.com/r/norge/comments/1xlz4r8/',
    publisher: 'reddit.com',
    grade: 'D',
  },
]);
assert.equal(redditOnly.length, 0);

assert.equal(researchTopicHasOpenableBrief('done'), true);
assert.equal(researchTopicHasOpenableBrief('failed'), false);

assert.equal(resolveResearchTopicSourceKey({ sourceKind: 'cluster', clusterId: 'c1' }), 'cluster:c1');

console.log('lib/admin/research/topic-brief-schema.test.ts: ok');
