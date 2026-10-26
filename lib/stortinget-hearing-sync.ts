import { chunkDocumentText } from '@/lib/document-chunking';
import {
  buildHearingChunkMetadata,
  getHoringsprogramApiUrl,
  mapHearingToDbRow,
  type StortingetHoringsprogram,
} from '@/lib/stortinget-hearing-export';
import { resolveHearingDocumentsForIngest } from '@/lib/stortinget-hearing-document-fetch';
import { fetchStortingetHoringerLive } from '@/lib/stortinget-horinger';
import { getServiceSupabase } from '@/lib/supabase';

export type { HearingDocumentDraft, StortingetHoringsprogram } from '@/lib/stortinget-hearing-export';
export {
  buildHoringsprogramMarkdown,
  getHoringsprogramApiUrl,
  getStortingetHoringPageUrl,
  hearingDocumentsFromExport,
  mapHearingToDbRow,
} from '@/lib/stortinget-hearing-export';

export type SyncHearingsResult = {
  hearingsUpserted: number;
  documentsUpserted: number;
  chunksWritten: number;
  total: number;
};

async function fetchHoringsprogram(hearingId: string): Promise<StortingetHoringsprogram | null> {
  try {
    const res = await fetch(getHoringsprogramApiUrl(hearingId), {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as StortingetHoringsprogram;
  } catch {
    return null;
  }
}

async function upsertHearingChunks(
  hearingId: string,
  documentId: string,
  hearingDocumentId: string,
  title: string,
  kind: string,
  sourceUrl: string | null,
  markdown: string,
  sesjon: string | null,
  komite: string | null,
  contentHash: string,
): Promise<number> {
  const service = getServiceSupabase();
  const chunks = chunkDocumentText(markdown);
  if (chunks.length === 0) return 0;

  const rows = chunks.map((content, chunkIndex) => ({
    issue_id: null,
    hearing_id: hearingId,
    hearing_document_id: hearingDocumentId,
    document_id: documentId,
    chunk_index: chunkIndex,
    content,
    embedding_status: 'pending',
    metadata: buildHearingChunkMetadata({
      hearingId,
      documentId,
      documentKind: kind,
      documentTitle: title,
      sourceUrl,
      sesjon,
      komite,
      contentHash,
    }),
  }));

  const payload = rows.map((row) => ({
    chunk_index: row.chunk_index,
    content: row.content,
    embedding_status: row.embedding_status,
    metadata: row.metadata,
  }));

  const { data: replaceResult, error: replaceError } = await service.rpc(
    'n8n_replace_hearing_document_chunks',
    {
      p_hearing_document_id: hearingDocumentId,
      p_hearing_id: hearingId,
      p_document_id: documentId,
      p_chunks: payload,
    },
  );
  if (replaceError) throw replaceError;

  const result = replaceResult as { ok?: boolean; count?: number } | null;
  if (result?.ok === false) {
    throw new Error('n8n_replace_hearing_document_chunks failed');
  }

  return Number(result?.count ?? rows.length);
}

export async function syncStortingetHearingsToDb(): Promise<SyncHearingsResult> {
  const hearings = await fetchStortingetHoringerLive();
  const service = getServiceSupabase();
  const now = new Date().toISOString();

  let hearingsUpserted = 0;
  let documentsUpserted = 0;
  let chunksWritten = 0;

  for (const hearing of hearings) {
    const hearingId = String(hearing.id);
    const row = mapHearingToDbRow(hearing, now);

    const { error: hearingError } = await service.from('stortinget_hearings').upsert(row, {
      onConflict: 'id',
    });
    if (hearingError) throw hearingError;
    hearingsUpserted += 1;

    const program = await fetchHoringsprogram(hearingId);
    const resolved = await resolveHearingDocumentsForIngest(hearing, program, 120_000);

    for (const { draft, markdown } of resolved) {
      const { data: docRow, error: docError } = await service.rpc('n8n_upsert_hearing_document', {
        p_payload: {
          hearing_id: hearingId,
          external_key: draft.externalKey,
          title: draft.title,
          kind: draft.kind,
          source_url: draft.sourceUrl,
          markdown,
          status: 'converted',
          content_hash: draft.contentHash,
        },
      });
      if (docError) throw docError;
      documentsUpserted += 1;

      const documentId =
        typeof docRow === 'object' && docRow && 'id' in docRow
          ? String((docRow as { id: string }).id)
          : null;
      if (!documentId || !markdown) continue;

      const written = await upsertHearingChunks(
        hearingId,
        documentId,
        documentId,
        draft.title,
        draft.kind,
        draft.sourceUrl,
        markdown,
        row.sesjon,
        row.komite_navn,
        draft.contentHash,
      );
      chunksWritten += written;
    }
  }

  return {
    hearingsUpserted,
    documentsUpserted,
    chunksWritten,
    total: hearings.length,
  };
}
