import assert from 'node:assert/strict';
import {
  filterAndSearchSakDocuments,
  filterSakDocumentsByKind,
  sakDocumentDisplayTitle,
  sakDocumentsLinkLabel,
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

assert.equal(sakDocumentDisplayTitle('Stortingsreferat 09.04.2026'), 'Stortingsreferat 9. april 2026');
assert.equal(sakDocumentDisplayTitle('Innst. 458 S (2025-2026)'), 'Innst. 458 S (2025-2026)');

const referat: SakDocumentRef = { ...docs[0], id: '3', title: 'Stortingsreferat 09.04.2026', kind: 'referat' };
assert.equal(searchSakDocumentsByTitle([referat], '9. april').length, 1, 'søk matcher visningstittelen');
assert.equal(searchSakDocumentsByTitle([referat], '09.04.2026').length, 1, 'søk matcher fortsatt lagret tittel');
assert.equal(referat.title, 'Stortingsreferat 09.04.2026', 'lagret tittel er uendret');

assert.equal(sakDocumentsLinkLabel(4), 'Se alle 4 dokumenter');
assert.equal(sakDocumentsLinkLabel(1), 'Se dokumentet på saken');

console.log('lib/sak/documents-filter.test.ts: ok');