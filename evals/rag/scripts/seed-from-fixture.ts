import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type pg from 'pg';
import { chunkDocument } from '@/lib/document-chunking';
import { buildDocumentChunkMetadata, documentContentHash } from '@/lib/document-chunking';
import { chunkDocumentTextBaseline } from '../lib/baseline-chunking';
import type { EvalVariant } from '../lib/db';
import { embedBgeM3, embedNomic } from '../lib/embed';
import type { CorpusSnapshot } from './fetch-fixture-snapshot';

export type SeedCounts = {
  issues: number;
  documents: number;
  chunks: number;
  hearings: number;
  fixtureFetchedAt: string;
};

export function loadCorpusSnapshot(): CorpusSnapshot {
  const path = join(process.cwd(), 'evals/rag/fixtures/corpus-snapshot.json');
  return JSON.parse(readFileSync(path, 'utf8')) as CorpusSnapshot;
}

export async function seedFromFixture(pool: pg.Pool, variant: EvalVariant): Promise<SeedCounts> {
  const snapshot = loadCorpusSnapshot();
  const cfg = snapshot.config;
  let documentCount = 0;
  let chunkCount = 0;

  for (const issue of snapshot.issues) {
    const sak = issue.sak;
    const id = issue.id;
    const title = String(sak.korttittel ?? sak.innstillingstekst ?? `Sak ${id}`);
    const summary = String(sak.kortvedtak ?? sak.innstillingstekst ?? '').slice(0, 4000);
    await pool.query(
      `INSERT INTO stortinget_issues (id, title, summary, henvisning, ferdigbehandlet, detail_json, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,now())
       ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, summary=EXCLUDED.summary, henvisning=EXCLUDED.henvisning,
         ferdigbehandlet=EXCLUDED.ferdigbehandlet, detail_json=EXCLUDED.detail_json, last_synced_at=now()`,
      [
        id,
        title,
        summary,
        (sak.henvisning as string) ?? null,
        Boolean(sak.ferdigbehandlet),
        JSON.stringify(sak),
      ],
    );

    for (const doc of issue.documents) {
      documentCount += 1;
      const body = doc.body;
      const hash = documentContentHash(body);
      await pool.query(
        `INSERT INTO stortinget_issue_documents (issue_id, document_id, title, document_type, source_url, content_full_text, ingest_status)
         VALUES ($1,$2,$3,$4,$5,$6,'ready')
         ON CONFLICT (issue_id, document_id) DO UPDATE SET content_full_text=EXCLUDED.content_full_text`,
        [id, doc.documentId, doc.title, doc.kind, doc.sourceUrl, body],
      );
      await pool.query(`DELETE FROM document_chunks WHERE issue_id=$1 AND document_id=$2`, [id, doc.documentId]);

      const structured =
        variant === 'baseline'
          ? chunkDocumentTextBaseline(body).map((content) => ({
              content,
              sectionTitle: '',
              page: null,
              pageStart: null,
              pageEnd: null,
            }))
          : chunkDocument(body);

      const maxChunks = Number(process.env.RAG_EVAL_MAX_CHUNKS_PER_DOC ?? 28);
      const capped = structured.slice(0, maxChunks);
      for (let chunkIndex = 0; chunkIndex < capped.length; chunkIndex += 1) {
        const piece = capped[chunkIndex];
        const metadata = buildDocumentChunkMetadata({
          issueId: id,
          documentId: doc.documentId,
          documentKind: doc.kind,
          documentTitle: doc.title,
          sectionTitle: piece.sectionTitle,
          page: piece.page,
          pageStart: piece.pageStart,
          pageEnd: piece.pageEnd,
          sourceUrl: doc.sourceUrl,
          sesjon: cfg.sessionId,
          komite: (sak.komite as { navn?: string })?.navn ?? null,
          publishedAt: null,
          contentHash: hash,
        });
        if (variant === 'baseline') {
          const embedding = await embedNomic(piece.content);
          await pool.query(
            `INSERT INTO document_chunks (issue_id, document_id, chunk_index, content, embedding, embedding_status, metadata)
             VALUES ($1,$2,$3,$4,$5::vector,'ready',$6)`,
            [id, doc.documentId, chunkIndex, piece.content, `[${embedding.join(',')}]`, JSON.stringify(metadata)],
          );
        } else {
          const embeddingV2 = await embedBgeM3(piece.content);
          await pool.query(
            `INSERT INTO document_chunks (issue_id, document_id, chunk_index, content, embedding_status, metadata, embedding_v2)
             VALUES ($1,$2,$3,$4,'ready',$5,$6::vector)`,
            [id, doc.documentId, chunkIndex, piece.content, JSON.stringify(metadata), `[${embeddingV2.join(',')}]`],
          );
        }
        chunkCount += 1;
      }
    }
  }

  const prefix = snapshot.syntheticPrefix;
  await pool.query(
    `INSERT INTO stortinget_issues (id, title, summary, henvisning, ferdigbehandlet, detail_json, last_synced_at)
     VALUES ($1,$2,$3,$4,false,'{}',now()) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title`,
    [prefix.id, prefix.title, prefix.summary, prefix.henvisning],
  );
  const prefixChunks =
    variant === 'baseline'
      ? chunkDocumentTextBaseline(prefix.body)
      : chunkDocument(prefix.body).map((c) => c.content);
  await pool.query(`DELETE FROM document_chunks WHERE issue_id=$1`, [prefix.id]);
  for (let i = 0; i < Math.min(prefixChunks.length, 6); i += 1) {
    const content = typeof prefixChunks[i] === 'string' ? prefixChunks[i] : prefixChunks[i].content;
    if (variant === 'baseline') {
      const embedding = await embedNomic(content);
      await pool.query(
        `INSERT INTO document_chunks (issue_id, document_id, chunk_index, content, embedding, embedding_status, metadata)
         VALUES ($1,'prefix-doc',$2,$3,$4::vector,'ready','{}')`,
        [prefix.id, i, content, `[${embedding.join(',')}]`],
      );
    } else {
      const embeddingV2 = await embedBgeM3(content);
      await pool.query(
        `INSERT INTO document_chunks (issue_id, document_id, chunk_index, content, embedding_status, metadata, embedding_v2)
         VALUES ($1,'prefix-doc',$2,$3,'ready','{}',$4::vector)`,
        [prefix.id, i, content, `[${embeddingV2.join(',')}]`],
      );
    }
    chunkCount += 1;
  }
  documentCount += 1;

  if (variant === 'stack') {
    for (const h of snapshot.hearings) {
      await pool.query(
        `INSERT INTO stortinget_hearings (id, tittel, sesjon, komite_navn, skriftlig_innspill_url, detail_json, last_synced_at)
         VALUES ($1,$2,$3,$4,'', $5, now())
         ON CONFLICT (id) DO UPDATE SET tittel=EXCLUDED.tittel, detail_json=EXCLUDED.detail_json`,
        [
          h.id,
          String((h.hearing.tittel as string) ?? 'Høring'),
          String((h.hearing.sesjon as string) ?? cfg.sessionId),
          String((h.hearing.komite_navn as string) ?? ''),
          JSON.stringify(h.hearing),
        ],
      );
      for (const doc of h.documents) {
        documentCount += 1;
        const docId = `hearing-${h.id}-${doc.externalKey}`;
        const hash = documentContentHash(doc.markdown);
        const { rows: hd } = await pool.query<{ id: string }>(
          `INSERT INTO hearing_documents (hearing_id, external_key, title, kind, source_url, markdown, status, content_hash)
           VALUES ($1,$2,$3,$4,$5,$6,'chunked',$7)
           ON CONFLICT (hearing_id, external_key) DO UPDATE SET markdown=EXCLUDED.markdown RETURNING id`,
          [h.id, doc.externalKey, doc.title, doc.kind, doc.sourceUrl, doc.markdown, hash],
        );
        const chunks = chunkDocument(doc.markdown).slice(0, Number(process.env.RAG_EVAL_MAX_CHUNKS_PER_DOC ?? 24));
        await pool.query(`DELETE FROM document_chunks WHERE hearing_document_id=$1`, [hd[0].id]);
        for (let i = 0; i < chunks.length; i += 1) {
          const piece = chunks[i];
          const emb = await embedBgeM3(piece.content);
          await pool.query(
            `INSERT INTO document_chunks (issue_id, hearing_id, hearing_document_id, document_id, chunk_index, content, embedding_status, metadata, embedding_v2)
             VALUES (NULL,$1,$2,$3,$4,$5,'ready',$6,$7::vector)`,
            [
              h.id,
              hd[0].id,
              docId,
              i,
              piece.content,
              JSON.stringify({
                hearing_id: h.id,
                document_title: doc.title,
                document_kind: doc.kind,
              }),
              `[${emb.join(',')}]`,
            ],
          );
          chunkCount += 1;
        }
      }
    }
  }

  const counts: SeedCounts = {
    issues: snapshot.issues.length + 1,
    documents: documentCount,
    chunks: chunkCount,
    hearings: variant === 'stack' ? snapshot.hearings.length : 0,
    fixtureFetchedAt: snapshot.fetchedAt,
  };

  writeFileSync(
    join(process.cwd(), 'evals/rag/corpus-meta.json'),
    JSON.stringify({ variant, ...counts, prefixIssueId: prefix.id, seededAt: new Date().toISOString() }, null, 2),
  );
  console.log('[seed] fixture done', counts);
  return counts;
}
