import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type pg from 'pg';
import { chunkDocument } from '@/lib/document-chunking';
import { buildDocumentChunkMetadata, documentContentHash } from '@/lib/document-chunking';
import { parseSakDocuments } from '@/lib/stortinget-documents';
import { fetchPublikasjonHtml } from '@/lib/stortinget-publikasjon';
import { chunkDocumentTextBaseline } from './baseline-chunking';
import type { EvalVariant } from './db';
import { embedBgeM3, embedNomic } from './embed';

export type DistractorManifest = {
  generatedAt: string;
  sessions: string[];
  issueCount: number;
  issues: Array<{
    id: string;
    sessionId: string;
    korttittel: string;
    tittel: string;
    henvisning: string | null;
    komite: string | null;
  }>;
};

export function loadDistractorManifest(): DistractorManifest {
  const path = join(process.cwd(), 'evals/rag/fixtures/corpus-v2-distractor-manifest.json');
  return JSON.parse(readFileSync(path, 'utf8')) as DistractorManifest;
}

function distractorFallbackBody(row: DistractorManifest['issues'][0]): string {
  return [row.tittel, row.korttittel, row.henvisning ?? '', row.komite ?? ''].filter(Boolean).join('\n\n').trim();
}

async function fetchDistractorPublicationBody(
  issueId: string,
  maxDocs: number,
  maxChars: number,
): Promise<string | null> {
  const url = `https://data.stortinget.no/eksport/sak?sakid=${encodeURIComponent(issueId)}&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
  if (!res.ok) return null;
  const data = (await res.json()) as { sak?: Record<string, unknown> };
  const sak = data.sak;
  if (!sak) return null;
  for (const doc of parseSakDocuments(sak as never).slice(0, maxDocs)) {
    if (!doc.exportId) continue;
    const pub = await fetchPublikasjonHtml(doc.exportId);
    if (pub?.plainText) return pub.plainText.slice(0, maxChars);
  }
  return null;
}

export async function seedDistractorIssues(args: {
  pool: pg.Pool;
  variant: EvalVariant;
  coreIssueIds: Set<string>;
  maxPublicationChars: number;
  maxDocumentsPerIssue: number;
}): Promise<{ issues: number; chunks: number; documents: number }> {
  const manifest = loadDistractorManifest();
  const ingestLive = process.env.RAG_EVAL_V2_DISTRACTOR_INGEST === '1';
  const skipChunks = process.env.RAG_EVAL_V2_SKIP_DISTRACTOR_CHUNKS === '1';
  const maxChunks = Number(process.env.RAG_EVAL_DISTRACTOR_MAX_CHUNKS ?? 1);
  let issues = 0;
  let chunks = 0;
  let documents = 0;

  for (const row of manifest.issues) {
    if (args.coreIssueIds.has(row.id)) continue;
    const title = row.korttittel || row.tittel || `Sak ${row.id}`;
    const summary = (row.tittel || row.korttittel || '').slice(0, 4000);
    await args.pool.query(
      `INSERT INTO stortinget_issues (id, title, summary, henvisning, ferdigbehandlet, detail_json, last_synced_at)
       VALUES ($1,$2,$3,$4,false,$5,now())
       ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, summary=EXCLUDED.summary, henvisning=EXCLUDED.henvisning`,
      [
        row.id,
        title,
        summary,
        row.henvisning,
        JSON.stringify({ id: row.id, korttittel: title, sak_sesjon: row.sessionId }),
      ],
    );
    issues += 1;
    if (skipChunks) continue;

    let body = distractorFallbackBody(row);
    if (ingestLive && body.length < 500) {
      const fetched = await fetchDistractorPublicationBody(row.id, args.maxDocumentsPerIssue, args.maxPublicationChars);
      if (fetched) body = fetched;
      await new Promise((r) => setTimeout(r, 120));
    }
    if (body.length < 40) continue;

    const docId = `distractor:${row.id}`;
    const hash = documentContentHash(body);
    documents += 1;
    await args.pool.query(
      `INSERT INTO stortinget_issue_documents (issue_id, document_id, title, document_type, source_url, content_full_text, ingest_status)
       VALUES ($1,$2,$3,'distractor_list',NULL,$4,'ready')
       ON CONFLICT (issue_id, document_id) DO UPDATE SET content_full_text=EXCLUDED.content_full_text`,
      [row.id, docId, title.slice(0, 200), body],
    );
    await args.pool.query(`DELETE FROM document_chunks WHERE issue_id=$1 AND document_id=$2`, [row.id, docId]);
    const structured =
      args.variant === 'baseline'
        ? chunkDocumentTextBaseline(body).map((content) => ({
            content,
            sectionTitle: '',
            page: null,
            pageStart: null,
            pageEnd: null,
          }))
        : chunkDocument(body);
    const capped = structured.slice(0, maxChunks);
    for (let chunkIndex = 0; chunkIndex < capped.length; chunkIndex += 1) {
      const piece = capped[chunkIndex];
      const metadata = buildDocumentChunkMetadata({
        issueId: row.id,
        documentId: docId,
        documentKind: 'distractor_list',
        documentTitle: title,
        sectionTitle: piece.sectionTitle,
        page: piece.page,
        pageStart: piece.pageStart,
        pageEnd: piece.pageEnd,
        sourceUrl: null,
        sesjon: row.sessionId,
        komite: row.komite,
        publishedAt: null,
        contentHash: hash,
      });
      if (args.variant === 'baseline') {
        const embedding = await embedNomic(piece.content);
        await args.pool.query(
          `INSERT INTO document_chunks (issue_id, document_id, chunk_index, content, embedding, embedding_status, metadata)
           VALUES ($1,$2,$3,$4,$5::vector,'ready',$6)`,
          [row.id, docId, chunkIndex, piece.content, `[${embedding.join(',')}]`, JSON.stringify(metadata)],
        );
      } else {
        const embeddingV2 = await embedBgeM3(piece.content);
        await args.pool.query(
          `INSERT INTO document_chunks (issue_id, document_id, chunk_index, content, embedding_status, metadata, embedding_v2)
           VALUES ($1,$2,$3,$4,'ready',$5,$6::vector)`,
          [row.id, docId, chunkIndex, piece.content, JSON.stringify(metadata), `[${embeddingV2.join(',')}]`],
        );
      }
      chunks += 1;
    }
    if (issues % 250 === 0) console.log(`[v2-seed] distractors ${issues}/${manifest.issueCount}`);
  }

  return { issues, chunks, documents };
}
