import { getServiceSupabase } from './supabase';
import { getCachedSakDetail } from './stortinget-detail-cache';
import { ingestSakDocuments } from './stortinget-document-ingest';

export const MAX_SAK_DOCUMENT_REFRESH_IDS = 10;
export const SYNC_DOCUMENT_BACKFILL_LIMIT = 10;

const EMPTY_ISSUE_ID = /^[0-9]+$/;

export type SakDocumentIngestStatus = 'ready' | 'failed' | 'external_only' | 'none';

export type SakDocumentRefreshResult = {
  id: string;
  ok: boolean;
  documentRows: number;
  status: SakDocumentIngestStatus;
  ingest: {
    processed: number;
    ready: number;
    externalOnly: number;
    failed: number;
    chunksCreated: number;
  };
  error?: string;
};

export function isValidStortingetIssueId(id: string): boolean {
  const trimmed = id.trim();
  return trimmed.length > 0 && EMPTY_ISSUE_ID.test(trimmed);
}

export function parseStortingetIssueIdsParam(raw: string | null | undefined): {
  valid: string[];
  invalid: string[];
} {
  if (!raw?.trim()) {
    return { valid: [], invalid: [] };
  }

  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const part of parts) {
    if (isValidStortingetIssueId(part)) {
      if (valid.length < MAX_SAK_DOCUMENT_REFRESH_IDS) {
        valid.push(part);
      }
    } else {
      invalid.push(part);
    }
  }

  return { valid, invalid };
}

export function resolveSakDocumentIngestStatus(ingest: {
  processed: number;
  ready: number;
  externalOnly: number;
  failed: number;
}): SakDocumentIngestStatus {
  if (ingest.processed === 0) return 'none';
  if (ingest.ready > 0) return 'ready';
  if (ingest.failed > 0) return 'failed';
  if (ingest.externalOnly > 0) return 'external_only';
  return 'none';
}

/**
 * Velg saker uten dokumentrader, eldste first_seen_at først (null til slutt).
 * Ren funksjon for testing av utvalgslogikk.
 */
export function pickIssueIdsMissingDocuments(args: {
  candidateIds: string[];
  issueIdsWithDocuments: Set<string>;
  firstSeenAtById: Map<string, string | null>;
  limit: number;
}): string[] {
  const missing = args.candidateIds.filter((id) => !args.issueIdsWithDocuments.has(id));

  const sorted = [...missing].sort((a, b) => {
    const aSeen = args.firstSeenAtById.get(a) ?? null;
    const bSeen = args.firstSeenAtById.get(b) ?? null;
    if (aSeen === bSeen) return a.localeCompare(b, 'nb');
    if (!aSeen) return 1;
    if (!bSeen) return -1;
    return aSeen.localeCompare(bSeen);
  });

  return sorted.slice(0, Math.max(0, args.limit));
}

async function countIssueDocumentRows(issueId: string): Promise<number> {
  try {
    const service = getServiceSupabase();
    const { count, error } = await service
      .from('stortinget_issue_documents')
      .select('document_id', { count: 'exact', head: true })
      .eq('issue_id', issueId);
    if (error) {
      console.warn(`[document-ingest] Kunne ikke telle dokumentrader issue_id=${issueId}:`, error);
      return 0;
    }
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function refreshSakDetailWithDocumentIngest(issueId: string): Promise<SakDocumentRefreshResult> {
  const emptyIngest = {
    processed: 0,
    ready: 0,
    externalOnly: 0,
    failed: 0,
    chunksCreated: 0,
  };

  try {
    console.log(`[document-ingest] Starter full detaljoppfriskning issue_id=${issueId}`);
    const detail = await getCachedSakDetail(issueId, {
      forceRefresh: true,
      skipBackgroundIngest: true,
    });

    if (!detail) {
      return {
        id: issueId,
        ok: false,
        documentRows: 0,
        status: 'none',
        ingest: emptyIngest,
        error: 'Fant ikke sakdetaljer',
      };
    }

    const ingest = await ingestSakDocuments(issueId, detail).catch((error) => {
      console.warn(`[document-ingest] Ingest feilet issue_id=${issueId}:`, error);
      return { ...emptyIngest, failed: 1, processed: 1 };
    });

    const documentRows = await countIssueDocumentRows(issueId);
    const status = resolveSakDocumentIngestStatus(ingest);
    console.log(
      `[document-ingest] Ferdig issue_id=${issueId} documentRows=${documentRows} status=${status}`,
    );

    return {
      id: issueId,
      ok: true,
      documentRows,
      status,
      ingest,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[document-ingest] Oppfriskning feilet issue_id=${issueId}:`, error);
    return {
      id: issueId,
      ok: false,
      documentRows: 0,
      status: 'failed',
      ingest: emptyIngest,
      error: message,
    };
  }
}

export async function refreshSakDetailsWithDocumentIngest(
  issueIds: string[],
): Promise<SakDocumentRefreshResult[]> {
  const results: SakDocumentRefreshResult[] = [];
  for (const issueId of issueIds) {
    results.push(await refreshSakDetailWithDocumentIngest(issueId));
  }
  return results;
}

export type DocumentBackfillResult = {
  attempted: number;
  issueIds: string[];
  results: SakDocumentRefreshResult[];
};

export async function selectSessionIssueIdsMissingDocuments(
  sessionIssueIds: string[],
  limit = SYNC_DOCUMENT_BACKFILL_LIMIT,
): Promise<string[]> {
  if (sessionIssueIds.length === 0) return [];

  let service;
  try {
    service = getServiceSupabase();
  } catch {
    return [];
  }

  const uniqueIds = [...new Set(sessionIssueIds)];

  const [{ data: docRows, error: docError }, { data: issueRows, error: issueError }] =
    await Promise.all([
      service.from('stortinget_issue_documents').select('issue_id').in('issue_id', uniqueIds),
      service
        .from('stortinget_issues')
        .select('id, first_seen_at')
        .in('id', uniqueIds),
    ]);

  if (docError) {
    console.warn('[document-ingest] Kunne ikke hente dokumentrader for backfill:', docError);
    return [];
  }
  if (issueError) {
    console.warn('[document-ingest] Kunne ikke hente first_seen_at for backfill:', issueError);
    return [];
  }

  const issueIdsWithDocuments = new Set((docRows ?? []).map((row) => String(row.issue_id)));
  const firstSeenAtById = new Map(
    (issueRows ?? []).map((row) => [String(row.id), (row.first_seen_at as string | null) ?? null]),
  );

  return pickIssueIdsMissingDocuments({
    candidateIds: uniqueIds,
    issueIdsWithDocuments,
    firstSeenAtById,
    limit,
  });
}

export async function backfillSessionSakDocuments(
  sessionIssueIds: string[],
  limit = SYNC_DOCUMENT_BACKFILL_LIMIT,
): Promise<DocumentBackfillResult> {
  const issueIds = await selectSessionIssueIdsMissingDocuments(sessionIssueIds, limit);
  if (issueIds.length === 0) {
    return { attempted: 0, issueIds: [], results: [] };
  }

  console.log(
    `[document-ingest] Sync backfill starter for ${issueIds.length} saker: ${issueIds.join(', ')}`,
  );
  const results = await refreshSakDetailsWithDocumentIngest(issueIds);
  return { attempted: issueIds.length, issueIds, results };
}