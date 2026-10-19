import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type pg from 'pg';
import { chunkDocument } from '@/lib/document-chunking';
import { buildDocumentChunkMetadata, documentContentHash } from '@/lib/document-chunking';
import { parseSakDocuments } from '@/lib/stortinget-documents';
import { fetchPublikasjonHtml } from '@/lib/stortinget-publikasjon';
import type { StortingetHoring } from '@/lib/stortinget-horinger';
import {
  getHoringsprogramApiUrl,
  hearingDocumentsFromExport,
  mapHearingToDbRow,
  type StortingetHoringsprogram,
} from '@/lib/stortinget-hearing-export';
import { chunkDocumentTextBaseline } from '../lib/baseline-chunking';
import type { EvalVariant } from '../lib/db';
import { embedBgeM3, embedNomic } from '../lib/embed';
import {
  aggregatePartyStancesFromVoteringRows,
  formatVoteringSummary,
} from '../lib/v2-party-score';
import { v2CorpusConfigPath, v2FixtureBodiesPath, v2SnapshotPath } from '../lib/v2-paths';

type CorpusV2Config = {
  sessionId: string;
  coreIssues: string[];
  hearings: string[];
  maxDocumentsPerIssue: number;
  maxPublicationChars: number;
};

type SnapshotIssue = {
  id: string;
  tittel: string;
  henvisning?: string;
  komite?: string;
};

type SnapshotHearing = {
  id: string;
  sakIds?: string[];
  tittel?: string;
  komite?: string;
  status?: string;
};

type SnapshotVotering = { id: string; sakId: string; tema: string; vedtatt: boolean };

type V2BodiesFixture = {
  fetchedAt: string;
  issues: Array<{
    id: string;
    documents: Array<{ documentId: string; title: string; kind: string; sourceUrl: string | null; body: string }>;
  }>;
  hearingBodies: Record<string, string>;
  excludedHearings: Array<{ id: string; reason: string }>;
};

async function fetchWithRetry(url: string, attempts = 5): Promise<Response> {
  let delay = 1200;
  for (let i = 0; i < attempts; i += 1) {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (res.status !== 429) return res;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 25_000);
  }
  return fetch(url, { signal: AbortSignal.timeout(60_000) });
}

async function fetchSakJson(id: string): Promise<Record<string, unknown> | null> {
  const url = `https://data.stortinget.no/eksport/sak?sakid=${encodeURIComponent(id)}&format=json`;
  const res = await fetchWithRetry(url);
  if (!res.ok) return null;
  const data = (await res.json()) as { sak?: Record<string, unknown> };
  return data.sak ?? null;
}

async function fetchHearingsForSession(sessionId: string): Promise<StortingetHoring[]> {
  const url = `https://data.stortinget.no/eksport/horinger?sesjonid=${encodeURIComponent(sessionId)}&format=json`;
  const res = await fetchWithRetry(url);
  if (!res.ok) return [];
  const data = (await res.json()) as { horinger_liste?: StortingetHoring[] };
  return data.horinger_liste ?? [];
}

async function fetchPublication(exportId: string, maxChars: number): Promise<string | null> {
  for (let i = 0; i < 4; i += 1) {
    const pub = await fetchPublikasjonHtml(exportId);
    if (pub?.plainText) return pub.plainText.slice(0, maxChars);
    await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
  }
  return null;
}

async function fetchVoteringSummaryText(voteringId: string, tema: string): Promise<string | null> {
  const url = `https://data.stortinget.no/eksport/voteringsresultat?voteringid=${encodeURIComponent(voteringId)}&format=json`;
  const res = await fetchWithRetry(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    voteringsresultat_liste?: Array<{ votering?: number; representant?: { parti?: { id?: string } } }>;
  };
  const rows =
    data.voteringsresultat_liste?.map((r) => ({
      partiId: String(r.representant?.parti?.id ?? ''),
      votering: Number(r.votering ?? 0),
    })) ?? [];
  const stances = aggregatePartyStancesFromVoteringRows(rows.filter((r) => r.partiId));
  if (Object.keys(stances).length === 0) return null;
  return formatVoteringSummary(voteringId, tema, stances);
}

function snapshotFallbackBody(issue: SnapshotIssue): string {
  return [issue.tittel, issue.henvisning ?? '', issue.komite ?? ''].filter(Boolean).join('\n\n').trim();
}

async function loadOrBuildBodies(
  cfg: CorpusV2Config,
  snapshotIssues: SnapshotIssue[],
  hearingIds: string[],
): Promise<V2BodiesFixture> {
  const fixturePath = v2FixtureBodiesPath();
  let cached: V2BodiesFixture | null = null;
  if (existsSync(fixturePath) && process.env.RAG_EVAL_V2_LIVE_FETCH !== '1') {
    cached = JSON.parse(readFileSync(fixturePath, 'utf8')) as V2BodiesFixture;
    if (process.env.RAG_EVAL_V2_SKIP_ISSUE_FETCH === '1') {
      const liveHearings = await fetchHearingsForSession(cfg.sessionId);
      const liveIds = new Set(liveHearings.map((h) => String(h.id)));
      const hearingBodies: Record<string, string> = {};
      const excludedHearings: Array<{ id: string; reason: string }> = [];
      for (const hearingId of hearingIds) {
        if (!liveIds.has(hearingId)) {
          excludedHearings.push({ id: hearingId, reason: 'missing_from_live_horinger_export' });
          continue;
        }
        const hearing = liveHearings.find((h) => String(h.id) === hearingId)!;
        let program: StortingetHoringsprogram | null = null;
        try {
          const res = await fetchWithRetry(getHoringsprogramApiUrl(hearingId));
          if (res.ok) program = (await res.json()) as StortingetHoringsprogram;
        } catch {
          program = null;
        }
        const drafts = hearingDocumentsFromExport(hearing, program);
        const parts: string[] = [];
        for (const draft of drafts) {
          let markdown = draft.markdown;
          if (!markdown && draft.sourceUrl) {
            const m = draft.sourceUrl.match(/publikasjonid=([^&]+)/i);
            if (m?.[1]) markdown = await fetchPublication(m[1], cfg.maxPublicationChars);
          }
          if (markdown) parts.push(markdown.slice(0, cfg.maxPublicationChars));
        }
        if (parts.length === 0) {
          excludedHearings.push({ id: hearingId, reason: 'no_hearing_documents_in_export' });
          continue;
        }
        hearingBodies[hearingId] = parts.join('\n\n');
      }
      return { ...cached, hearingBodies, excludedHearings, fetchedAt: new Date().toISOString() };
    }
    return cached;
  }

  const issueMap = new Map(snapshotIssues.map((i) => [i.id, i]));
  const issues: V2BodiesFixture['issues'] = [];
  for (const issueId of cfg.coreIssues) {
    const meta = issueMap.get(issueId);
    const sak = await fetchSakJson(issueId);
    const documents: V2BodiesFixture['issues'][0]['documents'] = [];
    if (sak) {
      for (const doc of parseSakDocuments(sak as never).slice(0, cfg.maxDocumentsPerIssue)) {
        if (!doc.exportId) continue;
        const body = await fetchPublication(doc.exportId, cfg.maxPublicationChars);
        if (!body) continue;
        documents.push({
          documentId: doc.id,
          title: doc.title,
          kind: doc.kind,
          sourceUrl: doc.sourceUrl,
          body,
        });
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    if (documents.length === 0 && meta) {
      const body = snapshotFallbackBody(meta);
      if (body.length >= 40) {
        documents.push({
          documentId: `snapshot:${issueId}`,
          title: meta.tittel.slice(0, 200),
          kind: 'snapshot_metadata',
          sourceUrl: null,
          body: body.slice(0, cfg.maxPublicationChars),
        });
      }
    }
    if (documents.length > 0) issues.push({ id: issueId, documents });
    if (issues.length % 10 === 0) console.log(`[v2-seed] fetched issues ${issues.length}/${cfg.coreIssues.length}`);
  }

  const liveHearings = await fetchHearingsForSession(cfg.sessionId);
  const liveIds = new Set(liveHearings.map((h) => String(h.id)));
  const hearingBodies: Record<string, string> = {};
  const excludedHearings: Array<{ id: string; reason: string }> = [];
  for (const hearingId of hearingIds) {
    if (!liveIds.has(hearingId)) {
      excludedHearings.push({ id: hearingId, reason: 'missing_from_live_horinger_export' });
      continue;
    }
    const hearing = liveHearings.find((h) => String(h.id) === hearingId)!;
    let program: StortingetHoringsprogram | null = null;
    try {
      const res = await fetchWithRetry(getHoringsprogramApiUrl(hearingId));
      if (res.ok) program = (await res.json()) as StortingetHoringsprogram;
    } catch {
      program = null;
    }
    const drafts = hearingDocumentsFromExport(hearing, program);
    const parts: string[] = [];
    for (const draft of drafts) {
      let markdown = draft.markdown;
      if (!markdown && draft.sourceUrl) {
        const m = draft.sourceUrl.match(/publikasjonid=([^&]+)/i);
        if (m?.[1]) markdown = await fetchPublication(m[1], cfg.maxPublicationChars);
      }
      if (markdown) parts.push(markdown.slice(0, cfg.maxPublicationChars));
    }
    if (parts.length === 0) {
      excludedHearings.push({ id: hearingId, reason: 'no_hearing_documents_in_export' });
      continue;
    }
    hearingBodies[hearingId] = parts.join('\n\n');
  }

  const fixture: V2BodiesFixture = {
    fetchedAt: new Date().toISOString(),
    issues,
    hearingBodies,
    excludedHearings,
  };
  writeFileSync(fixturePath, JSON.stringify(fixture));
  console.log(`[v2-seed] wrote fixture ${fixturePath}`);
  return fixture;
}

export async function seedCorpusV2(pool: pg.Pool, variant: EvalVariant): Promise<Record<string, unknown>> {
  const cfg = JSON.parse(readFileSync(v2CorpusConfigPath(), 'utf8')) as CorpusV2Config;
  const snapshot = JSON.parse(readFileSync(v2SnapshotPath(), 'utf8')) as {
    issues: SnapshotIssue[];
    hearings: SnapshotHearing[];
    voteringer: SnapshotVotering[];
  };

  const bodies = await loadOrBuildBodies(cfg, snapshot.issues, cfg.hearings);
  const issueMeta = new Map(snapshot.issues.map((i) => [i.id, i]));
  let documentCount = 0;
  let chunkCount = 0;
  let voteringChunks = 0;

  for (const issue of bodies.issues) {
    const meta = issueMeta.get(issue.id);
    const title = meta?.tittel ?? `Sak ${issue.id}`;
    const summary = (meta?.tittel ?? '').slice(0, 4000);
    await pool.query(
      `INSERT INTO stortinget_issues (id, title, summary, henvisning, ferdigbehandlet, detail_json, last_synced_at)
       VALUES ($1,$2,$3,$4,false,$5,now())
       ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, summary=EXCLUDED.summary, henvisning=EXCLUDED.henvisning`,
      [issue.id, title, summary, meta?.henvisning ?? null, JSON.stringify({ id: issue.id, korttittel: title })],
    );

    for (const doc of issue.documents) {
      documentCount += 1;
      const hash = documentContentHash(doc.body);
      await pool.query(
        `INSERT INTO stortinget_issue_documents (issue_id, document_id, title, document_type, source_url, content_full_text, ingest_status)
         VALUES ($1,$2,$3,$4,$5,$6,'ready')
         ON CONFLICT (issue_id, document_id) DO UPDATE SET content_full_text=EXCLUDED.content_full_text`,
        [issue.id, doc.documentId, doc.title, doc.kind, doc.sourceUrl, doc.body],
      );
      await pool.query(`DELETE FROM document_chunks WHERE issue_id=$1 AND document_id=$2`, [issue.id, doc.documentId]);
      const structured =
        variant === 'baseline'
          ? chunkDocumentTextBaseline(doc.body).map((content) => ({
              content,
              sectionTitle: '',
              page: null,
              pageStart: null,
              pageEnd: null,
            }))
          : chunkDocument(doc.body);
      const capped = structured.slice(0, Number(process.env.RAG_EVAL_MAX_CHUNKS_PER_DOC ?? 24));
      for (let chunkIndex = 0; chunkIndex < capped.length; chunkIndex += 1) {
        const piece = capped[chunkIndex];
        const metadata = buildDocumentChunkMetadata({
          issueId: issue.id,
          documentId: doc.documentId,
          documentKind: doc.kind,
          documentTitle: doc.title,
          sectionTitle: piece.sectionTitle,
          page: piece.page,
          pageStart: piece.pageStart,
          pageEnd: piece.pageEnd,
          sourceUrl: doc.sourceUrl,
          sesjon: cfg.sessionId,
          komite: meta?.komite ?? null,
          publishedAt: null,
          contentHash: hash,
        });
        if (variant === 'baseline') {
          const embedding = await embedNomic(piece.content);
          await pool.query(
            `INSERT INTO document_chunks (issue_id, document_id, chunk_index, content, embedding, embedding_status, metadata)
             VALUES ($1,$2,$3,$4,$5::vector,'ready',$6)`,
            [issue.id, doc.documentId, chunkIndex, piece.content, `[${embedding.join(',')}]`, JSON.stringify(metadata)],
          );
        } else {
          const embeddingV2 = await embedBgeM3(piece.content);
          await pool.query(
            `INSERT INTO document_chunks (issue_id, document_id, chunk_index, content, embedding_status, metadata, embedding_v2)
             VALUES ($1,$2,$3,$4,'ready',$5,$6::vector)`,
            [issue.id, doc.documentId, chunkIndex, piece.content, JSON.stringify(metadata), `[${embeddingV2.join(',')}]`],
          );
        }
        chunkCount += 1;
      }
    }
  }

  if (variant === 'stack') {
    const voteringBySak = new Map<string, SnapshotVotering[]>();
    for (const v of snapshot.voteringer) {
      const list = voteringBySak.get(v.sakId) ?? [];
      list.push(v);
      voteringBySak.set(v.sakId, list);
    }
    for (const [sakId, voteringer] of voteringBySak) {
      for (const v of voteringer) {
        const summary = await fetchVoteringSummaryText(v.id, v.tema);
        if (!summary) continue;
        const docId = `votering:${v.id}`;
        await pool.query(`DELETE FROM document_chunks WHERE issue_id=$1 AND document_id=$2`, [sakId, docId]);
        const emb = await embedBgeM3(summary);
        await pool.query(
          `INSERT INTO document_chunks (issue_id, document_id, chunk_index, content, embedding_status, metadata, embedding_v2)
           VALUES ($1,$2,0,$3,'ready','{}',$4::vector)`,
          [sakId, docId, summary, `[${emb.join(',')}]`],
        );
        chunkCount += 1;
        voteringChunks += 1;
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    const liveHearings = await fetchHearingsForSession(cfg.sessionId);
    for (const hearingId of cfg.hearings) {
      if (bodies.excludedHearings.some((e) => e.id === hearingId)) continue;
      const markdown = bodies.hearingBodies[hearingId];
      if (!markdown) continue;
      const hearing = liveHearings.find((h) => String(h.id) === hearingId);
      if (!hearing) continue;
      await pool.query(
        `INSERT INTO stortinget_hearings (id, tittel, sesjon, komite_navn, skriftlig_innspill_url, detail_json, last_synced_at)
         VALUES ($1,$2,$3,$4,'', $5, now())
         ON CONFLICT (id) DO UPDATE SET tittel=EXCLUDED.tittel`,
        [
          hearingId,
          String(hearing.tittel ?? 'Høring'),
          cfg.sessionId,
          String(hearing.komite_navn ?? ''),
          JSON.stringify(hearing),
        ],
      );
      const docId = `hearing-${hearingId}-export`;
      const hash = documentContentHash(markdown);
      const { rows: hd } = await pool.query<{ id: string }>(
        `INSERT INTO hearing_documents (hearing_id, external_key, title, kind, source_url, markdown, status, content_hash)
         VALUES ($1,'export:primary',$2,'horing_export',NULL,$3,'chunked',$4)
         ON CONFLICT (hearing_id, external_key) DO UPDATE SET markdown=EXCLUDED.markdown RETURNING id`,
        [hearingId, hearing.tittel ?? 'Høring', markdown, hash],
      );
      documentCount += 1;
      const chunks = chunkDocument(markdown).slice(0, Number(process.env.RAG_EVAL_MAX_CHUNKS_PER_DOC ?? 24));
      await pool.query(`DELETE FROM document_chunks WHERE hearing_document_id=$1`, [hd[0].id]);
      for (let i = 0; i < chunks.length; i += 1) {
        const piece = chunks[i];
        const emb = await embedBgeM3(piece.content);
        await pool.query(
          `INSERT INTO document_chunks (issue_id, hearing_id, hearing_document_id, document_id, chunk_index, content, embedding_status, metadata, embedding_v2)
           VALUES (NULL,$1,$2,$3,$4,$5,'ready','{}',$6::vector)`,
          [hearingId, hd[0].id, docId, i, piece.content, `[${emb.join(',')}]`],
        );
        chunkCount += 1;
      }
    }
  }

  const meta = {
    dataset: 'v2',
    variant,
    issues: bodies.issues.length,
    documents: documentCount,
    chunks: chunkCount,
    hearings: Object.keys(bodies.hearingBodies).length,
    excludedHearings: bodies.excludedHearings,
    voteringChunks,
    fixtureFetchedAt: bodies.fetchedAt,
    seededAt: new Date().toISOString(),
  };
  writeFileSync(join(process.cwd(), 'evals/rag/corpus-meta.json'), JSON.stringify(meta, null, 2));
  console.log('[v2-seed] done', meta);
  return meta;
}
