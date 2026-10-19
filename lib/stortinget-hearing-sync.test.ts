import assert from 'node:assert/strict';
import {
  buildHearingChunkMetadata,
  buildHoringsprogramMarkdown,
  hearingDocumentsFromExport,
  mapHearingToDbRow,
} from '@/lib/stortinget-hearing-export';
import type { StortingetHoring } from '@/lib/stortinget-horinger';

const hearing: StortingetHoring = {
  id: '10005933',
  horing_status: 'Planlagt',
  skriftlig: true,
  innspillsfrist: '/Date(1793055540000+0100)/',
  komite: { id: 'KONTROLL', navn: 'Kontroll- og konstitusjonskomiteen' },
  horing_sak_info_liste: [
    {
      sak_id: 200365,
      sak_tittel: 'Kontroll og kultur i utenrikstjenesten',
      sak_henvisning: 'Dokument 8:1 S (2025-2026)',
      sak_publikasjon: '//www.stortinget.no/no/Saker-og-publikasjoner/Publikasjoner/Representantforslag/2025-2026/dok8-202526-001s/',
    },
  ],
};

const markdown = buildHoringsprogramMarkdown({
  tittel: 'Åpen høring',
  innledning: 'Komiteen ber om innspill.',
  horingsprogram_element_liste: [
    { rekkefolge_nummer: 1, tekst: 'Innledning', tidsangivelse: '09.00' },
  ],
});
assert.match(markdown, /Åpen høring/);
assert.match(markdown, /Komiteen ber om innspill/);
assert.match(markdown, /Innledning \(09\.00\)/);

const docs = hearingDocumentsFromExport(hearing, {
  horingsprogram_liste: [{ tittel: 'Program', innledning: 'Tekst' }],
});
assert.equal(docs.length, 2);
assert.equal(docs[0].kind, 'horingsprogram');
assert.equal(docs[0].status, 'converted');
assert.equal(docs[1].kind, 'sak_publikasjon');
assert.equal(docs[1].status, 'pending');
assert.ok(docs[1].sourceUrl?.startsWith('https://'));

const row = mapHearingToDbRow(hearing, '2026-10-19T12:00:00.000Z');
assert.equal(row.id, '10005933');
assert.deepEqual(row.related_issue_ids, ['200365']);
assert.match(row.skriftlig_innspill_url, /h=10005933/);

const meta = buildHearingChunkMetadata({
  hearingId: '10005933',
  documentId: 'doc-uuid',
  documentKind: 'horingsprogram',
  documentTitle: 'Program',
  sourceUrl: 'https://example.com',
  sesjon: '2025-2029',
  komite: 'Justiskomiteen',
  contentHash: 'abc',
});
assert.equal(meta.hearing_id, '10005933');
assert.equal(meta.issue_id, null);
assert.equal(meta.content_hash, 'abc');

console.log('stortinget-hearing-sync.test.ts ok');
