import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildDedicatedResearchTopicSakDetail,
  getDedicatedResearchTopicSakBundle,
} from '@/lib/sak/dedicated-research-topic-bundle';
import { researchTopicDedicatedIssueId } from '@/lib/sak/research-topic-dedicated-issue';

const detailCacheSrc = readFileSync(
  join(process.cwd(), 'lib/stortinget-detail-cache.ts'),
  'utf8',
);
const dedicatedBranch =
  detailCacheSrc.match(
    /if \(isResearchTopicDedicatedIssueId\(sakId\)\) \{\n    const \{ data: row \}[\s\S]*?buildDedicatedResearchTopicSakDetail/,
  )?.[0] ?? '';
assert.ok(dedicatedBranch.length > 0);
assert.doesNotMatch(dedicatedBranch, /getSakDetail/);
assert.doesNotMatch(dedicatedBranch, /ingestSakDocuments/);
assert.doesNotMatch(dedicatedBranch, /triggerAiSummaryWebhook/);

const stortingetSrc = readFileSync(join(process.cwd(), 'lib/stortinget.ts'), 'utf8');
assert.match(stortingetSrc, /getDedicatedResearchTopicSakBundle/);

const sakId = researchTopicDedicatedIssueId('550e8400-e29b-41d4-a716-446655440000');
const detail = buildDedicatedResearchTopicSakDetail(sakId, {
  title: 'Formueskatt',
  summary: 'Nøytral ingress.',
});
assert.equal(detail.korttittel, 'Formueskatt');
assert.equal(detail.tittel, 'Nøytral ingress.');

async function main() {
  const bundleWithoutDb = await getDedicatedResearchTopicSakBundle(sakId);
  assert.equal(bundleWithoutDb, null);
  console.log('lib/sak/dedicated-research-topic-bundle.test.ts: ok');
}

void main();
