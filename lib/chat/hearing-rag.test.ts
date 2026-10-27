import assert from 'node:assert/strict';
import type { StortingetHoring } from '@/lib/stortinget-horinger';
import type { ChatRagClient } from '@/lib/chat/rag';
import {
  hearingChunkDocumentLabel,
  hearingMetaFromStortingetExport,
  hearingSearchNoteForEmptyChunks,
  searchHearingDocuments,
} from './hearing-rag';

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
    },
  ],
};

const meta = hearingMetaFromStortingetExport('10005933', hearing);
assert.equal(meta.id, '10005933');
assert.match(meta.title, /Kontroll og kultur/);
assert.equal(meta.committee, 'Kontroll- og konstitusjonskomiteen');
assert.ok(meta.deadline);
assert.match(meta.skriftligInnspillUrl, /h=10005933/);

const notIndexed = hearingSearchNoteForEmptyChunks({
  documentsIndexed: false,
});
assert.match(notIndexed.note, /ikke indeksert/i);
assert.match(notIndexed.note, /findHearingsForSak|listOpenHearings/);
assert.match(notIndexed.guidance ?? '', /findHearingsForSak|listOpenHearings/);

const indexedEmpty = hearingSearchNoteForEmptyChunks({
  documentsIndexed: true,
});
assert.match(indexedEmpty.note, /Fant ingen dokumentutdrag/);
assert.equal(indexedEmpty.guidance, null);

assert.equal(hearingChunkDocumentLabel({ documentTitle: 'Program', hearingId: '1' }), 'Program');
assert.equal(hearingChunkDocumentLabel({ documentTitle: null, hearingId: '1' }), 'Høringsdokument');
assert.equal(hearingChunkDocumentLabel({ documentTitle: null, hearingId: '' }), 'Dokument');
assert.equal(hearingChunkDocumentLabel({ documentTitle: '  ', hearingId: '1' }), 'Høringsdokument');

const stubClient = {
  rpc: async (fn: string) => {
    if (fn === 'search_chunks_hybrid') {
      return { data: null, error: { code: 'PGRST202', message: 'search_chunks_hybrid not in schema' } };
    }
    if (fn === 'search_hearing_document_chunks_text') {
      return {
        data: null,
        error: { code: 'PGRST202', message: 'search_hearing_document_chunks_text not in schema' },
      };
    }
    return { data: null, error: null };
  },
  from: () => ({
    select: () => ({
      eq: async () => ({ count: 0, error: null }),
    }),
  }),
} as unknown as ChatRagClient;

void (async () => {
  const short = await searchHearingDocuments({ query: 'x', hearingId: '10005933', client: stubClient });
  assert.match(short.note ?? '', /minst to tegn/);

  const missingMigration = await searchHearingDocuments({
    query: 'innspill',
    hearingId: '10005933',
    client: stubClient,
  });
  assert.equal(missingMigration.documentsIndexed, false);
  assert.match(missingMigration.note ?? '', /ikke indeksert/i);
  assert.ok(missingMigration.guidance);
  // Meta comes from Stortinget export (live list), not from hearing RPCs.
  if (missingMigration.hearing) {
    assert.equal(missingMigration.hearing.id, '10005933');
    assert.ok(missingMigration.hearing.title.length > 0);
  }

  console.log('chat/hearing-rag.test.ts: ok');
})();
