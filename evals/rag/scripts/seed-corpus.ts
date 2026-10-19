import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedFromFixture } from './seed-from-fixture';
import { chunkDocument } from '@/lib/document-chunking';
import { buildDocumentChunkMetadata, documentContentHash } from '@/lib/document-chunking';
import { parseSakDocuments } from '@/lib/stortinget-documents';
import { fetchPublikasjonHtml } from '@/lib/stortinget-publikasjon';
import { fetchStortingetHoringerLive } from '@/lib/stortinget-horinger';
import {
  getHoringsprogramApiUrl,
  hearingDocumentsFromExport,
  mapHearingToDbRow,
  type StortingetHoringsprogram,
} from '@/lib/stortinget-hearing-export';
import { chunkDocumentTextBaseline } from '../lib/baseline-chunking';
import { createPool, databaseForVariant, type EvalVariant } from '../lib/db';
import { embedBgeM3, embedNomic } from '../lib/embed';

type CorpusConfig = {
  sessionId: string;
  coreIssues: string[];
  hearings: string[];
  distractorCount: number;
  maxDocumentsPerIssue: number;
  maxPublicationChars: number;
};

type SakJson = {
  id?: number | string;
  korttittel?: string;
  kortvedtak?: string;
  henvisning?: string;
  ferdigbehandlet?: boolean;
  innstillingstekst?: string;
  komite?: { navn?: string };
  sak_sesjon?: string;
  publikasjon_referanse_liste?: unknown[];
};

async function fetchSakJson(id: string): Promise<SakJson | null> {
  const url = `https://data.stortinget.no/eksport/sak?sakid=${encodeURIComponent(id)}&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) return null;
  const data = (await res.json()) as { sak?: SakJson } | SakJson;
  const sak = 'sak' in data && data.sak ? data.sak : (data as SakJson);
  return sak ?? null;
}

async function fetchIssueIds(sessionId: string, limit: number): Promise<string[]> {
  const url = `https://data.stortinget.no/eksport/saker?sesjonid=${encodeURIComponent(sessionId)}&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    saker_liste?: Array<{ id?: number | string; korttittel?: string }>;
  };
  const list = data.saker_liste ?? [];
  return list
    .map((row) => String(row.id ?? '').trim())
    .filter(Boolean)
    .slice(0, limit);
}

async function fetchHoringsprogramJson(hearingId: string): Promise<StortingetHoringsprogram | null> {
  try {
    const res = await fetch(getHoringsprogramApiUrl(hearingId), { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    return (await res.json()) as StortingetHoringsprogram;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const variant = (process.env.RAG_EVAL_VARIANT ?? process.argv[2] ?? 'stack') as EvalVariant;
  if (process.env.RAG_EVAL_DATASET === 'v2') {
    const { createPool, databaseForVariant } = await import('../lib/db');
    const { seedCorpusV2 } = await import('./seed-corpus-v2');
    const pool = createPool(databaseForVariant(variant));
    await seedCorpusV2(pool, variant);
    await pool.end();
    return;
  }
  const fixturePath = join(process.cwd(), 'evals/rag/fixtures/corpus-snapshot.json');
  if (process.env.RAG_EVAL_LIVE_FETCH !== '1' && existsSync(fixturePath)) {
    const pool = createPool(databaseForVariant(variant));
    await seedFromFixture(pool, variant);
    await pool.end();
    return;
  }

  const cfg = JSON.parse(
    readFileSync(join(process.cwd(), 'evals/rag/corpus.json'), 'utf8'),
  ) as CorpusConfig;

  const pool = createPool(databaseForVariant(variant));
  const distractors = await fetchIssueIds(cfg.sessionId, cfg.distractorCount + cfg.coreIssues.length + 80);
  const issueIds = [...new Set([...cfg.coreIssues, ...distractors])].slice(
    0,
    cfg.coreIssues.length + cfg.distractorCount,
  );

  const hearingsOnly = process.env.RAG_EVAL_HEARINGS_ONLY === '1';
  console.log(
    `[seed] variant=${variant} issues=${issueIds.length} hearings=${cfg.hearings.length}${hearingsOnly ? ' (hearings only)' : ''}`,
  );

  if (!hearingsOnly) for (const issueId of issueIds) {
    const sak = await fetchSakJson(issueId);
    if (!sak) continue;
    const id = String(sak.id ?? issueId);
    const title = sak.korttittel ?? sak.innstillingstekst ?? `Sak ${id}`;
    const summary = sak.kortvedtak ?? sak.innstillingstekst ?? '';
    await pool.query(
      `INSERT INTO stortinget_issues (id, title, summary, henvisning, ferdigbehandlet, detail_json, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,now())
       ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, summary=EXCLUDED.summary, henvisning=EXCLUDED.henvisning,
         ferdigbehandlet=EXCLUDED.ferdigbehandlet, detail_json=EXCLUDED.detail_json, last_synced_at=now()`,
      [
        id,
        title,
        summary.slice(0, 4000),
        sak.henvisning ?? null,
        Boolean(sak.ferdigbehandlet),
        JSON.stringify(sak),
      ],
    );

    const docs = parseSakDocuments(sak as never).slice(0, cfg.maxDocumentsPerIssue);
    for (const doc of docs) {
      if (!doc.exportId) continue;
      const pub = await fetchPublikasjonHtml(doc.exportId);
      if (!pub?.plainText) continue;
      const body = pub.plainText.slice(0, cfg.maxPublicationChars);
      const hash = documentContentHash(body);
      await pool.query(
        `INSERT INTO stortinget_issue_documents (issue_id, document_id, title, document_type, source_url, content_full_text, ingest_status)
         VALUES ($1,$2,$3,$4,$5,$6,'ready')
         ON CONFLICT (issue_id, document_id) DO UPDATE SET title=EXCLUDED.title, content_full_text=EXCLUDED.content_full_text`,
        [id, doc.id, doc.title, doc.kind, doc.sourceUrl, body],
      );

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

      await pool.query(`DELETE FROM document_chunks WHERE issue_id=$1 AND document_id=$2`, [id, doc.id]);

      const maxChunks = Number(process.env.RAG_EVAL_MAX_CHUNKS_PER_DOC ?? 28);
      const capped = structured.slice(0, maxChunks);
      for (let chunkIndex = 0; chunkIndex < capped.length; chunkIndex += 1) {
        const piece = capped[chunkIndex];
        const metadata = buildDocumentChunkMetadata({
          issueId: id,
          documentId: doc.id,
          documentKind: doc.kind,
          documentTitle: doc.title,
          sectionTitle: piece.sectionTitle,
          page: piece.page,
          pageStart: piece.pageStart,
          pageEnd: piece.pageEnd,
          sourceUrl: doc.sourceUrl,
          sesjon: cfg.sessionId,
          komite: sak.komite?.navn ?? null,
          publishedAt: null,
          contentHash: hash,
        });

        if (variant === 'baseline') {
          const embedding = await embedNomic(piece.content);
          await pool.query(
            `INSERT INTO document_chunks (issue_id, document_id, chunk_index, content, embedding, embedding_status, metadata)
             VALUES ($1,$2,$3,$4,$5::vector,'ready',$6)`,
            [id, doc.id, chunkIndex, piece.content, `[${embedding.join(',')}]`, JSON.stringify(metadata)],
          );
        } else {
          const embeddingV2 = await embedBgeM3(piece.content);
          await pool.query(
            `INSERT INTO document_chunks (issue_id, document_id, chunk_index, content, embedding_status, metadata, embedding_v2)
             VALUES ($1,$2,$3,$4,'ready',$5,$6::vector)`,
            [id, doc.id, chunkIndex, piece.content, JSON.stringify(metadata), `[${embeddingV2.join(',')}]`],
          );
        }
      }
      console.log(`  sak ${id} doc ${doc.id} chunks=${capped.length}`);
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  if (variant === 'stack') {
    const liveHearings = await fetchStortingetHoringerLive();
    for (const hearingId of cfg.hearings) {
      const hearing = liveHearings.find((h) => String(h.id) === hearingId);
      if (!hearing) {
        console.warn(`  hearing ${hearingId} not in live export`);
        continue;
      }
      const row = mapHearingToDbRow(hearing, new Date().toISOString());
      await pool.query(
        `INSERT INTO stortinget_hearings (id, tittel, sesjon, komite_navn, skriftlig_innspill_url, detail_json, last_synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,now())
         ON CONFLICT (id) DO UPDATE SET tittel=EXCLUDED.tittel, komite_navn=EXCLUDED.komite_navn, detail_json=EXCLUDED.detail_json, last_synced_at=now()`,
        [
          hearingId,
          row.tittel,
          row.sesjon,
          row.komite_navn,
          row.skriftlig_innspill_url,
          JSON.stringify(hearing),
        ],
      );

      const program = await fetchHoringsprogramJson(hearingId);
      let drafts = hearingDocumentsFromExport(hearing, program);
      if (drafts.length === 0) {
        const sak = hearing.horing_sak_info_liste?.[0];
        const title = sak?.sak_korttittel?.trim() || sak?.sak_tittel?.trim() || row.tittel;
        const body = [
          `# ${title}`,
          '',
          hearing.status_info_tekst?.trim() || '',
          sak?.sak_henvisning ? `Henvisning: ${sak.sak_henvisning}` : '',
        ]
          .filter(Boolean)
          .join('\n');
        drafts = [
          {
            externalKey: 'synthetic:overview',
            title,
            kind: 'horingsoversikt',
            sourceUrl: null,
            markdown: body,
            status: 'converted',
            contentHash: documentContentHash(body),
          },
        ];
      }
      let wroteHearingChunks = 0;
      for (const draft of drafts) {
        let markdown = draft.markdown;
        if (!markdown && draft.sourceUrl) {
          const exportMatch = draft.sourceUrl.match(/publikasjonid=([^&]+)/i);
          if (exportMatch?.[1]) {
            const pub = await fetchPublikasjonHtml(exportMatch[1]);
            markdown = pub?.plainText ?? null;
          }
        }
        if (!markdown) continue;
        const docId = `hearing-${hearingId}-${draft.externalKey}`;
        const hash = documentContentHash(markdown);
        const { rows: hd } = await pool.query<{ id: string }>(
          `INSERT INTO hearing_documents (hearing_id, external_key, title, kind, source_url, markdown, status, content_hash)
           VALUES ($1,$2,$3,$4,$5,$6,'chunked',$7)
           ON CONFLICT (hearing_id, external_key) DO UPDATE SET markdown=EXCLUDED.markdown, status='chunked'
           RETURNING id`,
          [hearingId, draft.externalKey, draft.title, draft.kind, draft.sourceUrl, markdown, hash],
        );
        const hearingDocumentId = hd[0]?.id;
        const chunks = chunkDocument(markdown).slice(0, Number(process.env.RAG_EVAL_MAX_CHUNKS_PER_DOC ?? 24));
        await pool.query(`DELETE FROM document_chunks WHERE hearing_document_id=$1`, [hearingDocumentId]);
        for (let i = 0; i < chunks.length; i += 1) {
          const piece = chunks[i];
          const emb = await embedBgeM3(piece.content);
          await pool.query(
            `INSERT INTO document_chunks (issue_id, hearing_id, hearing_document_id, document_id, chunk_index, content, embedding_status, metadata, embedding_v2)
             VALUES (NULL,$1,$2,$3,$4,$5,'ready',$6,$7::vector)`,
            [
              hearingId,
              hearingDocumentId,
              docId,
              i,
              piece.content,
              JSON.stringify({
                hearing_id: hearingId,
                document_id: docId,
                document_title: draft.title,
                document_kind: draft.kind,
                content_hash: hash,
              }),
              `[${emb.join(',')}]`,
            ],
          );
        }
        wroteHearingChunks += chunks.length;
        console.log(`  hearing ${hearingId} doc ${draft.externalKey} chunks=${chunks.length}`);
      }
      if (wroteHearingChunks === 0) {
        const sak = hearing.horing_sak_info_liste?.[0];
        const title = sak?.sak_korttittel?.trim() || row.tittel;
        const markdown = `# ${title}\n\nHøringen gjelder ${title}. Innspill etterspørres til Stortingets komitébehandling av statsbudsjettet 2027.`;
        const docId = `hearing-${hearingId}-fallback`;
        const hash = documentContentHash(markdown);
        const { rows: hd } = await pool.query<{ id: string }>(
          `INSERT INTO hearing_documents (hearing_id, external_key, title, kind, markdown, status, content_hash)
           VALUES ($1,'fallback',$2,'horingsoversikt',$3,'chunked',$4)
           ON CONFLICT (hearing_id, external_key) DO UPDATE SET markdown=EXCLUDED.markdown RETURNING id`,
          [hearingId, title, markdown, hash],
        );
        const piece = chunkDocument(markdown)[0];
        const emb = await embedBgeM3(piece.content);
        await pool.query(
          `INSERT INTO document_chunks (issue_id, hearing_id, hearing_document_id, document_id, chunk_index, content, embedding_status, metadata, embedding_v2)
           VALUES (NULL,$1,$2,$3,0,$4,'ready',$5,$6::vector)`,
          [
            hearingId,
            hd[0].id,
            docId,
            piece.content,
            JSON.stringify({ hearing_id: hearingId, document_title: title, document_kind: 'horingsoversikt' }),
            `[${emb.join(',')}]`,
          ],
        );
        console.log(`  hearing ${hearingId} fallback chunks=1`);
      }
    }
  }

  if (!hearingsOnly) {
    const candidates = await fetchIssueIds(cfg.sessionId, 250);
    for (const candidateId of candidates) {
      const sak = await fetchSakJson(candidateId);
      const title = sak?.korttittel ?? '';
      if (!title.toLowerCase().includes('innvandring')) continue;
      const id = String(sak?.id ?? candidateId);
      await pool.query(
        `INSERT INTO stortinget_issues (id, title, summary, henvisning, ferdigbehandlet, detail_json, last_synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,now()) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title`,
        [id, title, sak?.kortvedtak ?? '', sak?.henvisning ?? null, Boolean(sak?.ferdigbehandlet), JSON.stringify(sak)],
      );
      const docs = parseSakDocuments(sak as never).slice(0, 1);
      for (const doc of docs) {
        if (!doc.exportId) continue;
        const pub = await fetchPublikasjonHtml(doc.exportId);
        if (!pub?.plainText) continue;
        const body = pub.plainText.slice(0, cfg.maxPublicationChars);
        const capped = (variant === 'baseline' ? chunkDocumentTextBaseline(body) : chunkDocument(body).map((c) => c.content)).slice(
          0,
          8,
        );
        for (let i = 0; i < capped.length; i += 1) {
          const content = typeof capped[i] === 'string' ? capped[i] : capped[i].content;
          if (variant === 'baseline') {
            const embedding = await embedNomic(content);
            await pool.query(
              `INSERT INTO document_chunks (issue_id, document_id, chunk_index, content, embedding, embedding_status, metadata)
               VALUES ($1,$2,$3,$4,$5::vector,'ready','{}') ON CONFLICT DO NOTHING`,
              [id, doc.id, i, content, `[${embedding.join(',')}]`],
            );
          } else {
            const embeddingV2 = await embedBgeM3(content);
            await pool.query(
              `INSERT INTO document_chunks (issue_id, document_id, chunk_index, content, embedding_status, metadata, embedding_v2)
               VALUES ($1,$2,$3,$4,'ready','{}',$5::vector) ON CONFLICT DO NOTHING`,
              [id, doc.id, i, content, `[${embeddingV2.join(',')}]`],
            );
          }
        }
        console.log(`  prefix sak ${id} innvandring chunks=${capped.length}`);
      }
      break;
    }
  }

  let prefixRow = await pool.query<{ id: string }>(
    `SELECT id FROM stortinget_issues WHERE title ILIKE '%innvandrings%' OR title ILIKE '%innvandring%' LIMIT 1`,
  );
  if (prefixRow.rows.length === 0 && !hearingsOnly) {
    const synthId = 'eval-innvandring-prefix';
    const title = 'Innvandringsloven (eval seed)';
    const body =
      'Lov om utlendingers adgang til riket og deres opphold og virksomhet her (innvandringsloven). Kapittel om innvandring og opphold.';
    await pool.query(
      `INSERT INTO stortinget_issues (id, title, summary, henvisning, ferdigbehandlet, detail_json, last_synced_at)
       VALUES ($1,$2,$3,'Prop. 99 L (eval)',false,'{}',now()) ON CONFLICT (id) DO NOTHING`,
      [synthId, title, body.slice(0, 200)],
    );
    const chunks = variant === 'baseline' ? chunkDocumentTextBaseline(body) : chunkDocument(body).map((c) => c.content);
    for (let i = 0; i < Math.min(chunks.length, 4); i += 1) {
      const content = typeof chunks[i] === 'string' ? chunks[i] : chunks[i].content;
      if (variant === 'baseline') {
        const embedding = await embedNomic(content);
        await pool.query(
          `INSERT INTO document_chunks (issue_id, document_id, chunk_index, content, embedding, embedding_status, metadata)
           VALUES ($1,'doc1',$2,$3,$4::vector,'ready','{}') ON CONFLICT DO NOTHING`,
          [synthId, i, content, `[${embedding.join(',')}]`],
        );
      } else {
        const embeddingV2 = await embedBgeM3(content);
        await pool.query(
          `INSERT INTO document_chunks (issue_id, document_id, chunk_index, content, embedding_status, metadata, embedding_v2)
           VALUES ($1,'doc1',$2,$3,'ready','{}',$4::vector) ON CONFLICT DO NOTHING`,
          [synthId, i, content, `[${embeddingV2.join(',')}]`],
        );
      }
    }
    console.log(`  synthetic prefix sak ${synthId}`);
    prefixRow = await pool.query<{ id: string }>(
      `SELECT id FROM stortinget_issues WHERE title ILIKE '%innvandring%' LIMIT 1`,
    );
  }
  const meta = {
    variant,
    issueCount: issueIds.length,
    prefixIssueId: prefixRow.rows[0]?.id ?? null,
    seededAt: new Date().toISOString(),
  };
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(process.cwd(), 'evals/rag/corpus-meta.json'), JSON.stringify(meta, null, 2));
  console.log('[seed] done', meta);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
