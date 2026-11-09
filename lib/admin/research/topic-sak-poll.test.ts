import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildResearchTopicNeutralSummary,
  buildResearchTopicPollSourceUrls,
  buildResearchTopicPublicTitle,
  validateResearchTopicPublicString,
} from '@/lib/admin/research/topic-sak-poll';
import {
  isResearchTopicDedicatedIssueId,
  researchTopicDedicatedIssueId,
} from '@/lib/sak/research-topic-dedicated-issue';
import { validateResearchTopicSakPollIngress } from '@/lib/admin/research/topic-sak-poll-client';
import { researchTopicSakPollCanCreate } from '@/lib/admin/research/topic-sak-poll-client';

const builderSrc = readFileSync(
  join(process.cwd(), 'lib/admin/research/topic-sak-poll.ts'),
  'utf8',
);
assert.doesNotMatch(builderSrc, /topic\.title/);
assert.doesNotMatch(builderSrc, /rawTitle/);
assert.match(builderSrc, /topic_title/);
assert.match(builderSrc, /syncDedicatedResearchTopicIssueText/);
assert.equal(validateResearchTopicPublicString('Innlegg om reddit'), 'Teksten kan ikke nevne Reddit');

const panelSrc = readFileSync(
  join(process.cwd(), 'components/admin/research-topic-sak-poll-panel.tsx'),
  'utf8',
);
assert.doesNotMatch(panelSrc, /@\/lib\/admin\/research\/topic-sak-poll['"]/);
assert.match(panelSrc, /topic-sak-poll-client/);

const baseOutput = {
  topic_title: 'Formueskatt i kommunene',
  current_rules: { items: ['Kommunene kan innføre formueskatt.'], note: 'ok' },
  party_proposals: {
    items: [{ party: 'Arbeiderpartiet', proposal: 'Begrense adgangen.' }],
    note: 'ok',
  },
  media_coverage: {
    items: [{ headline: 'Debatt om formuesskatt', summary: 'Lokalt engasjement.' }],
    note: 'ok',
  },
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
};

assert.equal(buildResearchTopicPublicTitle(baseOutput), 'Formueskatt i kommunene');
assert.equal(buildResearchTopicPublicTitle({ ...baseOutput, topic_title: undefined }), null);

const summary = buildResearchTopicNeutralSummary(baseOutput);
assert.equal(summary.hasContent, true);
assert.match(summary.text, /formueskatt/i);
assert.doesNotMatch(summary.text.toLowerCase(), /reddit/);

const emptyBrief = buildResearchTopicNeutralSummary({
  ...baseOutput,
  current_rules: { items: [], note: 'ingen funnet' },
  party_proposals: { items: [], note: 'ingen funnet' },
  media_coverage: { items: [], note: 'ingen funnet' },
});
assert.equal(emptyBrief.hasContent, false);
assert.equal(emptyBrief.text, '');
assert.equal(validateResearchTopicSakPollIngress(''), 'Nøytral ingress er påkrevd.');

const dedicatedId = researchTopicDedicatedIssueId('550e8400-e29b-41d4-a716-446655440000');
assert.ok(isResearchTopicDedicatedIssueId(dedicatedId));

const sourceUrlsDedicated = buildResearchTopicPollSourceUrls(dedicatedId, baseOutput);
assert.equal(sourceUrlsDedicated.length, 1);
assert.match(sourceUrlsDedicated[0]?.url ?? '', /nrk\.no/);
assert.doesNotMatch(JSON.stringify(sourceUrlsDedicated).toLowerCase(), /reddit/);

const sourceUrlsStortinget = buildResearchTopicPollSourceUrls('103102', baseOutput);
assert.equal(sourceUrlsStortinget.length, 2);
assert.match(sourceUrlsStortinget[0]?.url ?? '', /stortinget\.no/);

assert.equal(
  researchTopicSakPollCanCreate({ status: 'done', publishable: true }),
  true,
);
assert.equal(
  researchTopicSakPollCanCreate({ status: 'done', publishable: false }),
  false,
);
assert.equal(
  researchTopicSakPollCanCreate({ status: 'running', publishable: true }),
  false,
);

console.log('lib/admin/research/topic-sak-poll.test.ts: ok');
