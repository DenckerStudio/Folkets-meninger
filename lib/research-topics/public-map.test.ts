import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { filterPublishableSources, parseTopicBriefSources } from '@/lib/admin/research/topic-brief-schema';
import {
  isEligiblePublicResearchTopic,
  mapResearchTopicToPublicDetail,
  mapResearchTopicToPublicListItem,
  type ResearchTopicPublicSourceRow,
} from '@/lib/research-topics/public-map';
import { buildResearchTopicPublicTitle } from '@/lib/research-topics/public-content';

const adminOnlyTitle = 'Rå admin-tittel fra research_topics.title';

const baseOutput = {
  topic_title: 'Formueskatt i kommunene',
  current_rules: { items: ['Kommunene kan innføre formuesskatt.'], note: 'ok' },
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

function baseRow(overrides: Partial<ResearchTopicPublicSourceRow> = {}): ResearchTopicPublicSourceRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    status: 'done',
    publishable: true,
    output: baseOutput,
    finished_at: '2026-11-09T12:00:00.000Z',
    stortinget_issue_id: null,
    stortinget_poll_id: null,
    ...overrides,
  };
}

assert.equal(isEligiblePublicResearchTopic(baseRow()), true);
assert.equal(isEligiblePublicResearchTopic(baseRow({ publishable: false })), false);
assert.equal(isEligiblePublicResearchTopic(baseRow({ status: 'running' })), false);
assert.equal(isEligiblePublicResearchTopic(baseRow({ output: { ...baseOutput, topic_title: '' } })), false);

const mapped = mapResearchTopicToPublicListItem(baseRow());
assert.ok(mapped);
assert.equal(mapped?.topicTitle, 'Formueskatt i kommunene');
assert.notEqual(mapped?.topicTitle, adminOnlyTitle);
assert.equal(buildResearchTopicPublicTitle(baseOutput), mapped?.topicTitle);

const detail = mapResearchTopicToPublicDetail(baseRow());
assert.ok(detail);
assert.equal(detail?.sections.sources.length, 1);
assert.equal(detail?.sections.sources[0]?.url, 'https://www.nrk.no/sak');

const redditOutput = {
  ...baseOutput,
  topic_title: 'Tema uten røde flagg',
  sources: {
    items: [
      {
        id: 'r1',
        title: 'Diskusjon',
        url: 'https://www.reddit.com/r/norge/comments/abc/',
        publisher: 'reddit.com',
        grade: 'D',
      },
      {
        id: 's2',
        title: 'VG',
        url: 'https://www.vg.no/sak',
        publisher: 'vg.no',
        grade: 'B',
      },
    ],
    note: 'ok',
  },
};

const redditMapped = mapResearchTopicToPublicDetail(baseRow({ output: redditOutput }));
assert.ok(redditMapped);
assert.equal(redditMapped?.sections.sources.length, 1);
assert.equal(redditMapped?.sections.sources[0]?.url, 'https://www.vg.no/sak');

const redditOnly = filterPublishableSources(
  parseTopicBriefSources({
    items: [
      {
        id: 'r1',
        title: 'X',
        url: 'https://www.reddit.com/r/norge/x',
        grade: 'D',
      },
    ],
    note: 'ok',
  }),
);
assert.equal(redditOnly.length, 0);

const serviceSrc = readFileSync(join(process.cwd(), 'lib/research-topics/public-service.ts'), 'utf8');
assert.doesNotMatch(serviceSrc, /\btitle\b/);
assert.match(serviceSrc, /PUBLIC_TOPIC_SELECT/);

const routeSrc = readFileSync(join(process.cwd(), 'app/api/public/research-topics/route.ts'), 'utf8');
assert.doesNotMatch(routeSrc, /research_topics\.title/);
assert.doesNotMatch(routeSrc, /\.title\b/);

const mapSrc = readFileSync(join(process.cwd(), 'lib/research-topics/public-map.ts'), 'utf8');
assert.doesNotMatch(mapSrc, /rawTitle/);
assert.doesNotMatch(mapSrc, /research_topics\.title/);

console.log('lib/research-topics/public-map.test.ts: ok');
