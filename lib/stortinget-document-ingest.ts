import { createHash } from 'crypto';
import { chunkDocumentText } from '@/lib/document-chunking';
import { fetchPublikasjonHtml } from '@/lib/stortinget-publikasjon';
import { parseSakDocuments, type SakDocumentRef } from '@/lib/stortinget-documents';
import type { StortingetSakDetail } from '@/lib/stortinget';
import { getServiceSupabase } from '@/lib/supabase';
import { triggerDocumentEmbeddingsWebhook } from '@/lib/trigger-document-embeddings-webhook';

const INGEST_DELAY_MS = 400;

type IngestResult = {
  processed: number;
  ready: number;
  externalOnly: number;
  failed: number;
  chunksCreated: number;
};

function contentHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function upsertDocumentChunks(args: {
  service: ReturnType<typeof getServiceSupabase>;
  issueId: string;
  document: SakDocumentRef;
  plainText: string;
}): Promise<number> {
  const chunks = chunkDocumentText(args.plainText);
  if (chunks.length === 0) return 0;

  const { data: existingChunks } = await args.service
    .from('document_chunks')
    .select('chunk_index, content, embedding_status')
    .eq('issue_id', args.issueId)
    .eq('document_id', args.document.id);

  const existingByIndex = new Map(
    (existingChunks ?? []).map((row) => [
      row.chunk_index as number,
      {
        content: row.content as string,
        embeddingStatus: row.embedding_status as string,
      },
    ])
  );

  let created = 0;
  const rows = chunks
    .map((content, chunkIndex) => {
      const existing = existingByIndex.get(chunkIndex);
      if (existing?.content === content) return null;
      created += 1;
      return {
        issue_id: args.issueId,
        document_id: args.document.id,
        chunk_index: chunkIndex,
        content,
        embedding: null,
        embedding_status: 'pending',
        metadata: {
          document_title: args.document.title,
          document_kind: args.document.kind,
        },
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length > 0) {
    const { error } = await args.service.from('document_chunks').upsert(rows, {
      onConflict: 'issue_id,document_id,chunk_index',
    });

    if (error) {
      console.error('[document-ingest] chunk upsert failed:', error);
      return 0;
    }
  }

  const staleIndexes = (existingChunks ?? [])
    .map((row) => row.chunk_index as number)
    .filter((index) => index >= chunks.length);

  if (staleIndexes.length > 0) {
    await args.service
      .from('document_chunks')
      .delete()
      .eq('issue_id', args.issueId)
      .eq('document_id', args.document.id)
      .in('chunk_index', staleIndexes);
  }

  return created;
}

async function ingestOneDocument(args: {
  service: ReturnType<typeof getServiceSupabase>;
  issueId: string;
  document: SakDocumentRef;
}): Promise<{ status: 'ready' | 'external_only' | 'failed'; chunksCreated: number }> {
  const { service, issueId, document } = args;

  if (!document.viewable || !document.exportId) {
    await service.from('stortinget_issue_documents').upsert(
      {
        issue_id: issueId,
        document_id: document.id,
        title: document.title,
        document_type: document.documentType,
        source_url: document.sourceUrl,
        text_excerpt: null,
        content_html: null,
        content_full_text: null,
        mime_type: null,
        ingest_status: 'external_only',
        content_hash: contentHash(`${document.title}:${document.sourceUrl ?? ''}`),
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'issue_id,document_id' }
    );
    return { status: 'external_only', chunksCreated: 0 };
  }

  const fetched = await fetchPublikasjonHtml(document.exportId);
  if (!fetched) {
    await service.from('stortinget_issue_documents').upsert(
      {
        issue_id: issueId,
        document_id: document.id,
        title: document.title,
        document_type: document.documentType,
        source_url: document.sourceUrl,
        text_excerpt: null,
        content_html: null,
        content_full_text: null,
        mime_type: null,
        ingest_status: 'failed',
        content_hash: contentHash(document.exportId),
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'issue_id,document_id' }
    );
    return { status: 'failed', chunksCreated: 0 };
  }

  const hash = contentHash(fetched.plainText);
  const excerpt = fetched.plainText.slice(0, 3_000);

  await service.from('stortinget_issue_documents').upsert(
    {
      issue_id: issueId,
      document_id: document.id,
      title: document.title,
      document_type: document.documentType,
      source_url: document.sourceUrl,
      text_excerpt: excerpt,
      content_html: fetched.displayHtml,
      content_full_text: fetched.plainText,
      mime_type: fetched.mimeType,
      ingest_status: 'ready',
      content_hash: hash,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'issue_id,document_id' }
  );

  const chunksCreated = await upsertDocumentChunks({
    service,
    issueId,
    document,
    plainText: fetched.plainText,
  });

  return { status: 'ready', chunksCreated };
}

export async function ingestSakDocuments(
  issueId: string,
  detail: StortingetSakDetail | null | undefined
): Promise<IngestResult> {
  const documents = parseSakDocuments(detail);
  if (documents.length === 0) {
    return { processed: 0, ready: 0, externalOnly: 0, failed: 0, chunksCreated: 0 };
  }

  let service: ReturnType<typeof getServiceSupabase>;
  try {
    service = getServiceSupabase();
  } catch {
    return { processed: 0, ready: 0, externalOnly: 0, failed: 0, chunksCreated: 0 };
  }

  const result: IngestResult = {
    processed: 0,
    ready: 0,
    externalOnly: 0,
    failed: 0,
    chunksCreated: 0,
  };

  let shouldTriggerEmbeddings = false;

  for (const document of documents) {
    const { data: existing } = await service
      .from('stortinget_issue_documents')
      .select('content_hash, ingest_status')
      .eq('issue_id', issueId)
      .eq('document_id', document.id)
      .maybeSingle();

    if (existing?.ingest_status === 'ready' && existing.content_hash) {
      result.processed += 1;
      result.ready += 1;
      continue;
    }

    if (existing?.ingest_status === 'external_only') {
      result.processed += 1;
      result.externalOnly += 1;
      continue;
    }

    const status = await ingestOneDocument({ service, issueId, document });
    result.processed += 1;
    if (status.status === 'ready') {
      result.ready += 1;
      result.chunksCreated += status.chunksCreated;
      if (status.chunksCreated > 0) shouldTriggerEmbeddings = true;
    } else if (status.status === 'external_only') {
      result.externalOnly += 1;
    } else if (status.status === 'failed') {
      result.failed += 1;
    }

    await sleep(INGEST_DELAY_MS);
  }

  if (shouldTriggerEmbeddings) {
    triggerDocumentEmbeddingsWebhook(issueId);
  }

  return result;
}

export async function getSakDocumentsWithStatus(
  issueId: string,
  detail: StortingetSakDetail | null | undefined
) {
  const parsed = parseSakDocuments(detail);
  if (parsed.length === 0) return [];

  let service: ReturnType<typeof getServiceSupabase> | null = null;
  try {
    service = getServiceSupabase();
  } catch {
    service = null;
  }

  if (!service) {
    return parsed.map((doc) => ({ ...doc, ingestStatus: doc.viewable ? 'pending' : 'external_only' }));
  }

  const { data: rows } = await service
    .from('stortinget_issue_documents')
    .select('document_id, ingest_status')
    .eq('issue_id', issueId);

  const statusById = new Map((rows ?? []).map((row) => [row.document_id, row.ingest_status]));

  return parsed.map((doc) => ({
    ...doc,
    ingestStatus: statusById.get(doc.id) ?? (doc.viewable ? 'pending' : 'external_only'),
  }));
}
