import { chunkDocumentText } from '@/lib/document-chunking';
import {
  getHoringsprogramApiUrl,
  hearingDocumentsFromExport,
  mapHearingToDbRow,
  type StortingetHoringsprogram,
} from '@/lib/stortinget-hearing-export';
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
    metadata: {
      hearing_id: hearingId,
      document_title: title,
      document_kind: kind,
      source_url: sourceUrl,
    },
  }));

  const { error: deleteError } = await service
    .from('document_chunks')
    .delete()
    .eq('hearing_document_id', hearingDocumentId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await service.from('document_chunks').insert(rows);
  if (insertError) throw insertError;

  const { error: markError } = await service.rpc('n8n_mark_hearing_document_chunked', {
    p_document_id: hearingDocumentId,
  });
  if (markError) throw markError;

  return rows.length;
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
    const drafts = hearingDocumentsFromExport(hearing, program);

    for (const draft of drafts) {
      const { data: docRow, error: docError } = await service.rpc('n8n_upsert_hearing_document', {
        p_payload: {
          hearing_id: hearingId,
          external_key: draft.externalKey,
          title: draft.title,
          kind: draft.kind,
          source_url: draft.sourceUrl,
          markdown: draft.markdown,
          status: draft.status,
          content_hash: draft.contentHash,
        },
      });
      if (docError) throw docError;
      documentsUpserted += 1;

      const documentId =
        typeof docRow === 'object' && docRow && 'id' in docRow
          ? String((docRow as { id: string }).id)
          : null;
      if (!documentId || !draft.markdown) continue;

      const written = await upsertHearingChunks(
        hearingId,
        documentId,
        documentId,
        draft.title,
        draft.kind,
        draft.sourceUrl,
        draft.markdown,
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
