import {
  buildDocumentChunkMetadata,
  chunkDocument,
  documentContentHash,
} from '@/lib/document-chunking';
import { fetchPublikasjonHtml } from '@/lib/stortinget-publikasjon';
import { parseSakDocuments, type SakDocumentRef } from '@/lib/stortinget-documents';
import type { StortingetSakDetail } from '@/lib/stortinget';
import { getServiceSupabase } from '@/lib/supabase';
import { triggerDocumentEmbeddingsWebhook } from '@/lib/trigger-document-embeddings-webhook';
import { persistAiSummarySource } from '@/lib/ai-summary/persist-source';
import { triggerAiSummaryWebhook } from '@/lib/trigger-ai-summary-webhook';

const INGEST_DELAY_MS = 400;

type IngestResult = {
  processed: number;
  ready: number;
  externalOnly: number;
  failed: number;
  chunksCreated: number;
};

function contentHash(value: string): string {
  return documentContentHash(value);
}

function resolveKomiteName(detail: StortingetSakDetail | null | undefined): string | null {
  const raw = detail?.komite;
  if (!raw) return null;
  if (typeof raw === 'string') return raw.trim() || null;
  const name = raw.navn?.trim();
  return name || null;
}

function resolveSesjon(detail: StortingetSakDetail | null | undefined): string | null {
  const fromDetail = detail?.sak_sesjon?.trim();
  if (fromDetail) return fromDetail;
  const env =
    process.env.STORTINGET_SESSION_ID?.trim() ||
    process.env.NEXT_PUBLIC_STORTINGET_SESSION_ID?.trim() ||
    null;
  return env;
}

function resolvePublishedAt(detail: StortingetSakDetail | null | undefined): string | null {
  const raw = detail?.sist_oppdatert_dato;
  if (!raw || typeof raw !== 'string') return null;
  return raw.trim() || null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function upsertDocumentChunks(args: {
  service: ReturnType<typeof getServiceSupabase>;
  issueId: string;
  document: SakDocumentRef;
  bodyText: string;
  contentHash: string;
  issueContext: {
    sesjon: string | null;
    komite: string | null;
    publishedAt: string | null;
  };
}): Promise<number> {
  const chunks = chunkDocument(args.bodyText);
  if (chunks.length === 0) return 0;

  const { data: existingChunks } = await args.service
    .from('document_chunks')
    .select('chunk_index, content, embedding_status, metadata')
    .eq('issue_id', args.issueId)
    .eq('document_id', args.document.id);

  const existingByIndex = new Map(
    (existingChunks ?? []).map((row) => [
      row.chunk_index as number,
      {
        content: row.content as string,
        embeddingStatus: row.embedding_status as string,
        metadata: row.metadata as Record<string, unknown> | null,
      },
    ])
  );

  const unchanged =
    chunks.length === (existingChunks?.length ?? 0) &&
    chunks.every((chunk, chunkIndex) => {
      const existing = existingByIndex.get(chunkIndex);
      if (!existing) return false;
      const metaHash =
        existing.metadata && typeof existing.metadata.content_hash === 'string'
          ? existing.metadata.content_hash
          : null;
      return (
        existing.content === chunk.content &&
        metaHash === args.contentHash &&
        existing.embeddingStatus === 'ready'
      );
    });

  if (unchanged) return 0;

  let created = 0;
  const rows = chunks
    .map((chunk, chunkIndex) => {
      const existing = existingByIndex.get(chunkIndex);
      const metadata = buildDocumentChunkMetadata({
        issueId: args.issueId,
        documentId: args.document.id,
        documentKind: args.document.kind,
        documentTitle: args.document.title,
        sectionTitle: chunk.sectionTitle,
        page: chunk.page,
        sourceUrl: args.document.sourceUrl,
        sesjon: args.issueContext.sesjon,
        komite: args.issueContext.komite,
        publishedAt: args.issueContext.publishedAt,
        contentHash: args.contentHash,
      });

      const sameContent = existing?.content === chunk.content;
      const sameHash =
        existing?.metadata &&
        typeof existing.metadata.content_hash === 'string' &&
        existing.metadata.content_hash === args.contentHash;
      const sameMeta =
        sameHash &&
        JSON.stringify(existing?.metadata ?? {}) === JSON.stringify(metadata);

      if (sameContent && sameMeta && existing?.embeddingStatus === 'ready') return null;

      created += 1;
      const preserveEmbedding = sameContent && existing?.embeddingStatus === 'ready';
      const row = {
        issue_id: args.issueId,
        document_id: args.document.id,
        chunk_index: chunkIndex,
        content: chunk.content,
        embedding_status: preserveEmbedding ? 'ready' : 'pending',
        metadata,
        ...(preserveEmbedding ? {} : { embedding: null }),
      };
      return row;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const needsEmbedding = rows.some((row) => row.embedding_status === 'pending');

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

  // One text copy only: chunks hold RAG content; drop document body immediately.
  const hasChunks = created > 0 || (existingChunks?.length ?? 0) > 0 || chunks.length > 0;
  await args.service
    .from('stortinget_issue_documents')
    .update({
      content_full_text: null,
      content_html: null,
      chunks_status: !hasChunks ? 'none' : needsEmbedding ? 'pending' : 'ready',
    })
    .eq('issue_id', args.issueId)
    .eq('document_id', args.document.id);

  return created;
}

async function ingestOneDocument(args: {
  service: ReturnType<typeof getServiceSupabase>;
  issueId: string;
  document: SakDocumentRef;
  issueContext: {
    sesjon: string | null;
    komite: string | null;
    publishedAt: string | null;
  };
}): Promise<{ status: 'ready' | 'external_only' | 'failed'; chunksCreated: number }> {
  const { service, issueId, document, issueContext } = args;

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
        chunks_status: 'none',
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
        chunks_status: 'none',
        content_hash: contentHash(document.exportId),
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'issue_id,document_id' }
    );
    return { status: 'failed', chunksCreated: 0 };
  }

  const hash = contentHash(fetched.plainText);
  const excerpt = fetched.plainText.slice(0, 3_000);

  // Do not cache HTML (viewer fetches live). Plain text is temporary until chunked.
  await service.from('stortinget_issue_documents').upsert(
    {
      issue_id: issueId,
      document_id: document.id,
      title: document.title,
      document_type: document.documentType,
      source_url: document.sourceUrl,
      text_excerpt: excerpt,
      content_html: null,
      content_full_text: fetched.plainText,
      mime_type: fetched.mimeType,
      ingest_status: 'ready',
      chunks_status: 'pending',
      content_hash: hash,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'issue_id,document_id' }
  );

  const chunksCreated = await upsertDocumentChunks({
    service,
    issueId,
    document,
    bodyText: fetched.plainText,
    contentHash: hash,
    issueContext,
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
  const issueContext = {
    sesjon: resolveSesjon(detail),
    komite: resolveKomiteName(detail),
    publishedAt: resolvePublishedAt(detail),
  };

  for (const document of documents) {
    const { data: existing } = await service
      .from('stortinget_issue_documents')
      .select('content_hash, ingest_status, chunks_status')
      .eq('issue_id', issueId)
      .eq('document_id', document.id)
      .maybeSingle();

    if (existing?.ingest_status === 'ready' && existing.content_hash) {
      result.processed += 1;
      result.ready += 1;
      if (existing.chunks_status === 'pending') {
        shouldTriggerEmbeddings = true;
      }
      continue;
    }

    if (existing?.ingest_status === 'external_only') {
      result.processed += 1;
      result.externalOnly += 1;
      continue;
    }

    const status = await ingestOneDocument({ service, issueId, document, issueContext });
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

  if (result.chunksCreated > 0) {
    try {
      await persistAiSummarySource(issueId);
      triggerAiSummaryWebhook(issueId);
    } catch (error) {
      console.warn('[document-ingest] Kunne ikke oppdatere AI-kilde etter ingest:', error);
    }
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
