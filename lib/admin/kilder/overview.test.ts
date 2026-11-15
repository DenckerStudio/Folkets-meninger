import assert from 'node:assert/strict';
import { mapAdminKildeOverview, kildeOverviewNotReady } from '@/lib/admin/kilder/overview';
import { adminCaptureSourceTypeLabel, adminRagCorpusLabel } from '@/lib/admin/kilder/source-type-labels';

const mapped = mapAdminKildeOverview({
  generatedAt: '2026-11-15T12:00:00.000Z',
  lastChunkAt: '2026-11-14T10:00:00.000Z',
  ragBySourceType: [
    {
      source_type: 'proposisjon',
      corpus: 'stortinget_sak',
      document_count: 10,
      chunk_count: 200,
      chunks_7d: 5,
      chunks_30d: 40,
      chunks_90d: 120,
      last_chunk_at: '2026-11-14T10:00:00.000Z',
    },
  ],
  captureBySourceType: [{ source_type: 'reddit', source_count: 3, sources_7d: 1, sources_30d: 2, sources_90d: 3 }],
});

assert.equal(mapped.ready, true);
assert.equal(mapped.ragBySourceType[0]?.chunkCount, 200);
assert.equal(mapped.captureBySourceType[0]?.sourceCount, 3);
assert.equal(kildeOverviewNotReady.ready, false);

assert.equal(adminRagCorpusLabel('stortinget_sak'), 'Stortinget-sak');
assert.equal(adminCaptureSourceTypeLabel('reddit'), 'Sosialt signal');
assert.equal(adminCaptureSourceTypeLabel('news_rss'), 'Nyhets-RSS');

console.log('lib/admin/kilder/overview.test.ts: ok');