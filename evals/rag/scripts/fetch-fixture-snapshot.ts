/**
 * Fetch Stortinget corpus once (retry on 429) → evals/rag/fixtures/corpus-snapshot.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSakDocuments } from '@/lib/stortinget-documents';
import { fetchPublikasjonHtml } from '@/lib/stortinget-publikasjon';
import { fetchStortingetHoringerLive } from '@/lib/stortinget-horinger';
import {
  getHoringsprogramApiUrl,
  hearingDocumentsFromExport,
  mapHearingToDbRow,
  type StortingetHoringsprogram,
} from '@/lib/stortinget-hearing-export';

type CorpusConfig = {
  sessionId: string;
  coreIssues: string[];
  hearings: string[];
  distractorCount: number;
  maxDocumentsPerIssue: number;
  maxPublicationChars: number;
};

type FixtureDocument = {
  documentId: string;
  title: string;
  kind: string;
  sourceUrl: string | null;
  exportId: string | null;
  body: string;
};

type FixtureIssue = {
  id: string;
  sak: Record<string, unknown>;
  documents: FixtureDocument[];
};

type FixtureHearingDoc = {
  externalKey: string;
  title: string;
  kind: string;
  sourceUrl: string | null;
  markdown: string;
};

type FixtureHearing = {
  id: string;
  hearing: Record<string, unknown>;
  documents: FixtureHearingDoc[];
};

export type CorpusSnapshot = {
  snapshotVersion: 1;
  fetchedAt: string;
  config: CorpusConfig;
  issues: FixtureIssue[];
  hearings: FixtureHearing[];
  syntheticPrefix: {
    id: string;
    title: string;
    summary: string;
    henvisning: string;
    body: string;
  };
};

async function fetchWithRetry(url: string, attempts = 6): Promise<Response> {
  let delay = 1500;
  for (let i = 0; i < attempts; i += 1) {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (res.status !== 429) return res;
    console.warn(`[fixture] 429 ${url} — backoff ${delay}ms`);
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 30_000);
  }
  return fetch(url, { signal: AbortSignal.timeout(60_000) });
}

async function fetchSakJson(id: string): Promise<Record<string, unknown> | null> {
  const url = `https://data.stortinget.no/eksport/sak?sakid=${encodeURIComponent(id)}&format=json`;
  const res = await fetchWithRetry(url);
  if (!res.ok) return null;
  const data = (await res.json()) as { sak?: Record<string, unknown> } | Record<string, unknown>;
  const sak = 'sak' in data && data.sak ? data.sak : data;
  return sak ?? null;
}

async function fetchIssueIds(sessionId: string, limit: number): Promise<string[]> {
  const url = `https://data.stortinget.no/eksport/saker?sesjonid=${encodeURIComponent(sessionId)}&format=json`;
  const res = await fetchWithRetry(url);
  if (!res.ok) return [];
  const data = (await res.json()) as { saker_liste?: Array<{ id?: number | string }> };
  return (data.saker_liste ?? [])
    .map((row) => String(row.id ?? '').trim())
    .filter(Boolean)
    .slice(0, limit);
}

async function fetchPublication(exportId: string, maxChars: number): Promise<string | null> {
  for (let i = 0; i < 6; i += 1) {
    const pub = await fetchPublikasjonHtml(exportId);
    if (pub?.plainText) return pub.plainText.slice(0, maxChars);
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return null;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const cfg = JSON.parse(readFileSync(join(root, 'evals/rag/corpus.json'), 'utf8')) as CorpusConfig;
  const distractors = await fetchIssueIds(cfg.sessionId, cfg.distractorCount + cfg.coreIssues.length + 80);
  const issueIds = [...new Set([...cfg.coreIssues, ...distractors])].slice(
    0,
    cfg.coreIssues.length + cfg.distractorCount,
  );

  const issues: FixtureIssue[] = [];
  for (const issueId of issueIds) {
    const sak = await fetchSakJson(issueId);
    if (!sak) continue;
    const id = String(sak.id ?? issueId);
    const documents: FixtureDocument[] = [];
    for (const doc of parseSakDocuments(sak as never).slice(0, cfg.maxDocumentsPerIssue)) {
      if (!doc.exportId) continue;
      const body = await fetchPublication(doc.exportId, cfg.maxPublicationChars);
      if (!body) continue;
      documents.push({
        documentId: doc.id,
        title: doc.title,
        kind: doc.kind,
        sourceUrl: doc.sourceUrl,
        exportId: doc.exportId,
        body,
      });
      await new Promise((r) => setTimeout(r, 400));
    }
    if (documents.length === 0) {
      const fallbackBody = [
        String(sak.innstillingstekst ?? ''),
        String(sak.kortvedtak ?? ''),
        String(sak.korttittel ?? ''),
        String(sak.henvisning ?? ''),
      ]
        .filter(Boolean)
        .join('\n\n')
        .trim();
      if (fallbackBody.length < 80) {
        console.warn(`[fixture] skip issue ${id} — no publication and thin sak text`);
        continue;
      }
      documents.push({
        documentId: `synthetic:${id}`,
        title: String(sak.korttittel ?? `Sak ${id}`),
        kind: 'synthetic_sak_text',
        sourceUrl: null,
        exportId: null,
        body: fallbackBody.slice(0, cfg.maxPublicationChars),
      });
      console.log(`[fixture] issue ${id} synthetic doc (${fallbackBody.length} chars)`);
    }
    issues.push({ id, sak, documents });
    console.log(`[fixture] issue ${id} docs=${documents.length}`);
  }

  const hearings: FixtureHearing[] = [];
  const liveHearings = await fetchStortingetHoringerLive();
  for (const hearingId of cfg.hearings) {
    const hearing = liveHearings.find((h) => String(h.id) === hearingId);
    if (!hearing) continue;
    mapHearingToDbRow(hearing, new Date().toISOString());
    let program: StortingetHoringsprogram | null = null;
    try {
      const res = await fetchWithRetry(getHoringsprogramApiUrl(hearingId));
      if (res.ok) program = (await res.json()) as StortingetHoringsprogram;
    } catch {
      program = null;
    }
    let drafts = hearingDocumentsFromExport(hearing, program);
    if (drafts.length === 0) {
      const sak = hearing.horing_sak_info_liste?.[0];
      const title = sak?.sak_korttittel?.trim() || sak?.sak_tittel?.trim() || hearing.tittel;
      drafts = [
        {
          externalKey: 'synthetic:overview',
          title: title ?? 'Høring',
          kind: 'horingsoversikt',
          sourceUrl: null,
          markdown: `# ${title}\n\nStatsbudsjettet 2027. Innspill etterspørres.`,
          status: 'converted',
          contentHash: 'synthetic',
        },
      ];
    }
    const documents: FixtureHearingDoc[] = [];
    for (const draft of drafts) {
      let markdown = draft.markdown;
      if (!markdown && draft.sourceUrl) {
        const m = draft.sourceUrl.match(/publikasjonid=([^&]+)/i);
        if (m?.[1]) markdown = await fetchPublication(m[1], cfg.maxPublicationChars);
      }
      if (!markdown) continue;
      documents.push({
        externalKey: draft.externalKey,
        title: draft.title,
        kind: draft.kind,
        sourceUrl: draft.sourceUrl,
        markdown: markdown.slice(0, cfg.maxPublicationChars),
      });
    }
    if (documents.length === 0) {
      const sak = hearing.horing_sak_info_liste?.[0];
      const title = sak?.sak_korttittel?.trim() || sak?.sak_tittel?.trim() || hearing.tittel || 'Høring';
      documents.push({
        externalKey: 'synthetic:overview',
        title: title ?? 'Høring',
        kind: 'horingsoversikt',
        sourceUrl: null,
        markdown: `# ${title}\n\nStatsbudsjettet 2027. Innspill etterspørres.`,
      });
    }
    hearings.push({ id: hearingId, hearing: hearing as Record<string, unknown>, documents });
    console.log(`[fixture] hearing ${hearingId} docs=${documents.length}`);
  }

  const stubPath = join(root, 'evals/rag/fixtures/unavailable-sak-stubs.json');
  if (existsSync(stubPath)) {
    const stubs = JSON.parse(readFileSync(stubPath, 'utf8')) as FixtureIssue[];
    const have = new Set(issues.map((i) => i.id));
    for (const stub of stubs) {
      if (!have.has(stub.id)) {
        issues.push(stub);
        have.add(stub.id);
        console.log(`[fixture] merged API-unavailable stub ${stub.id}`);
      }
    }
  }

  const snapshot: CorpusSnapshot = {
    snapshotVersion: 1,
    fetchedAt: new Date().toISOString(),
    config: cfg,
    issues,
    hearings,
    syntheticPrefix: {
      id: 'eval-innvandring-prefix',
      title: 'Innvandringsloven (eval fixture)',
      summary: 'Lov om utlendingers adgang til riket (innvandringsloven).',
      henvisning: 'Prop. 99 L (eval)',
      body:
        'Lov om utlendingers adgang til riket og deres opphold og virksomhet her (innvandringsloven). ' +
        'Kapittel om innvandring, utlendinger og opphold. Innvandringspolitikk og innvandringsloven.',
    },
  };

  const dir = join(root, 'evals/rag/fixtures');
  mkdirSync(dir, { recursive: true });
  const out = join(dir, 'corpus-snapshot.json');
  writeFileSync(out, JSON.stringify(snapshot));
  console.log(`[fixture] wrote ${out} issues=${issues.length} hearings=${hearings.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
