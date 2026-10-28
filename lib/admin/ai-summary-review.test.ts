import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  adminReviewMark,
  groupSummarySources,
  orderSummariesForReview,
  summaryLabels,
  summaryNarrative,
  summaryReviewLabel,
} from '@/lib/admin/ai-summary-review';

assert.equal(summaryNarrative('  Fortellingen  ', 'hva'), 'Fortellingen');
assert.equal(summaryNarrative('   ', 'Hva saken gjelder'), 'Hva saken gjelder');
assert.equal(summaryNarrative(null, null), '');
assert.deepEqual(summaryLabels([' Energi ', 'Energi', '', 3, 'Skatt']), ['Energi', 'Skatt']);

const grouped = groupSummarySources([
  {
    issueId: '10',
    title: 'Nyere',
    sourceUrl: 'https://data.stortinget.no/ny',
    fetchedAt: '2026-10-02T00:00:00.000Z',
  },
  {
    issueId: '10',
    title: 'Eldre',
    sourceUrl: 'https://data.stortinget.no/eldre',
    fetchedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    issueId: '10',
    title: 'Duplikat',
    sourceUrl: 'https://data.stortinget.no/ny',
    fetchedAt: '2026-10-03T00:00:00.000Z',
  },
  {
    issueId: '11',
    title: null,
    sourceUrl: null,
    fetchedAt: null,
  },
]);

assert.deepEqual(grouped.get('10'), [
  { title: 'Duplikat', url: 'https://data.stortinget.no/ny' },
  { title: 'Eldre', url: 'https://data.stortinget.no/eldre' },
]);
assert.deepEqual(grouped.get('11'), [{ title: 'Dokument', url: null }]);

const routeSrc = readFileSync(
  join(process.cwd(), 'app/api/admin/ai-summaries/route.ts'),
  'utf8',
);
assert.match(routeSrc, /requireAdmin\(\)/);
assert.match(routeSrc, /listAiSummariesForReview/);
assert.doesNotMatch(routeSrc, /content_full_text|text_excerpt|ai_summary_source_context/);

const reviewSrc = readFileSync(
  join(process.cwd(), 'lib/admin/ai-summary-review.ts'),
  'utf8',
);
assert.match(reviewSrc, /content_feedback/);
assert.doesNotMatch(reviewSrc, /\.eq\('verdict'|\.not\('reviewMark'|superseded_at is not null/);
const listBody = reviewSrc.slice(reviewSrc.indexOf('export async function listAiSummariesForReview'));
assert.doesNotMatch(listBody, /filter\(\(row\).*reviewMark/);

assert.equal(adminReviewMark('admin', 'approve'), 'approve');
assert.equal(adminReviewMark('auto', 'approve'), null);
assert.equal(adminReviewMark('admin', 'maybe'), null);
assert.equal(summaryReviewLabel(null, true), 'Ikke vurdert');
assert.equal(summaryReviewLabel('reject', true), 'Avvist');
assert.equal(summaryReviewLabel(null, false), null);

const ordered = orderSummariesForReview([
  { id: 'reviewed-new', updatedAt: '2026-10-20T00:00:00.000Z', reviewMark: 'approve' as const, reviewLookupOk: true },
  { id: 'waiting-old', updatedAt: '2026-09-01T00:00:00.000Z', reviewMark: null, reviewLookupOk: true },
  { id: 'waiting-new', updatedAt: '2026-10-01T00:00:00.000Z', reviewMark: null, reviewLookupOk: true },
]);
assert.deepEqual(ordered.map((row) => row.id), ['waiting-new', 'waiting-old', 'reviewed-new']);

console.log('admin/ai-summary-review.test.ts: ok');
