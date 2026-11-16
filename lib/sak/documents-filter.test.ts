import assert from 'node:assert/strict';
import {
  filterAndSearchSakDocuments,
  filterSakDocumentsByKind,
  searchSakDocumentsByTitle,
} from '@/lib/sak/documents-filter';
import type { SakDocumentRef } from '@/lib/stortinget-documents';

const docs: SakDocumentRef[] = [
  {
    id: '1',
    title: 'Innst. 12 S (2025–2026)',
    kind: 'innstilling',
    exportId: null,
    sourceUrl: null,
    viewable: true,
    documentType: null,
  },
  {
    id: '2',
    title: 'Prop. 44 S (2025–2026)',
    kind: 'lovforslag',
    exportId: null,
    sourceUrl: null,
    viewable: true,
    documentType: null,
  },
];

assert.equal(filterSakDocumentsByKind(docs, 'innstilling').length, 1);
assert.equal(searchSakDocumentsByTitle(docs, 'prop').length, 1);
assert.equal(filterAndSearchSakDocuments(docs, 'lovforslag', 'prop').length, 1);

console.log('lib/sak/documents-filter.test.ts: ok');