import assert from 'node:assert/strict';
import { filterAndSearchSakDocuments } from '@/lib/sak/documents-filter';
import type { SakDocumentRef } from '@/lib/stortinget-documents';

const base = { exportId: null, documentType: null, sourceUrl: null, viewable: true } as const;

const source: readonly (SakDocumentRef & { ingestStatus: string })[] = [
  { ...base, id: 'a', title: 'Innstilling om skole', kind: 'innstilling', ingestStatus: 'ready' },
  { ...base, id: 'b', title: 'Proposisjon', kind: 'lovforslag', ingestStatus: 'ready' },
];

const filtered = filterAndSearchSakDocuments(source, 'innstilling', 'skole');
assert.equal(filtered.length, 1);
assert.equal(filtered[0]?.id, 'a');

const afterPollRefresh = filterAndSearchSakDocuments(
  [
    ...source,
    { ...base, id: 'c', title: 'Innstilling om skole revidert', kind: 'innstilling', ingestStatus: 'pending' },
  ],
  'innstilling',
  'skole',
);
assert.equal(afterPollRefresh.length, 2);

console.log('lib/sak/documents-display.test.ts: ok');