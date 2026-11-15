import type { StortingetSakDetail } from './stortinget';
import { getServiceSupabase } from './supabase';
import { getCachedSakDetail } from './stortinget-detail-cache';
import { ingestSakDocuments } from './stortinget-document-ingest';
import { parseSakDocuments } from './stortinget-documents';

export const MAX_SAK_DOCUMENT_REFRESH_IDS = 10;
export const SYNC_DOCUMENT_BACKFILL_LIMIT = 10;
export const ISSUE_DOCUMENT_LOOKUP_BATCH_SIZE = 100;

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

export function chunkIssueIds(ids: string[], batchSize = ISSUE_DOCUMENT_LOOKUP_BATCH_SIZE): string[][] {
  if (batchSize <= 0) return [ids];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    chunks.push(ids.slice(i, i + batchSize));
  }
  return chunks;
}

/**
 * Ekskluder saker der cachet detail_json ikke forventer dokumentrader (samme som ingest).
 * Manglende detail_json behandles som ukjent og kan fortsatt backfylles.
 */
export function issueCachedDetailExcludesDocumentBackfill(detailJson: unknown): boolean {
  if (detailJson == null) return false;
  return parseSakDocuments(detailJson as StortingetSakDetail).length === 0;
}

export function collectIssueIdsWithoutCachedDocumentRefs(
  issueRows: Array<{ id: string; detail_json: unknown }>,
): Set<string> {
  const excluded = new Set<string>();
  for (const row of issueRows) {
    if (issueCachedDetailExcludesDocumentBackfill(row.detail_json)) {
      excluded.add(String(row.id));
    }
  }
  return excluded;
}

export function computeUtcDayIndex(now: Date = new Date()): number {
  return Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000,
  );
}

/**
 * Velg saker uten dokumentrader, eldste first_seen_at først (null til slutt).
 * Roterer deterministisk slik at samme sett ikke blokkerer køen hver natt.
 */
export function pickIssueIdsMissingDocuments(args: {
  candidateIds: string[];
  issueIdsWithDocuments: Set<string>;
  issueIdsWithoutCachedDocumentRefs?: Set<string>;
  firstSeenAtById: Map<string, string | null>;
  limit: number;
  rotationOffset?: number;
}): string[] {
  const withoutRefs = args.issueIdsWithoutCachedDocumentRefs ?? new Set<string>();
  const missing = args.candidateIds.filter(
    (id) => !args.issueIdsWithDocuments.has(id) && !withoutRefs.has(id),
  );

  const sorted = [...missing].sort((a, b) => {
    const aSeen = args.firstSeenAtById.get(a) ?? null;
    const bSeen = args.firstSeenAtById.get(b) ?? null;
    if (aSeen === bSeen) return a.localeCompare(b, 'nb');
    if (!aSeen) return 1;
    if (!bSeen) return -1;
    return aSeen.localeCompare(bSeen);
  });

  const limit = Math.max(0, args.limit);
  if (sorted.length <= limit) {
    return sorted;
  }

  const offset =
    sorted.length > 0 ? (args.rotationOffset ?? 0) % sorted.length : 0;
  const rotated = [...sorted.slice(offset), ...sorted.slice(0, offset)];
  return rotated.slice(0, limit);
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

async function fetchIssueIdsWithStoredDocuments(
  service: ReturnType<typeof getServiceSupabase>,
  issueIds: string[],
): Promise<Set<string>> {
  const issueIdsWithDocuments = new Set<string>();

  for (const chunk of chunkIssueIds(issueIds)) {
    const { data, error } = await service
      .from('stortinget_issue_documents')
      .select('issue_id')
      .in('issue_id', chunk);

    if (error) {
      console.warn('[document-ingest] Kunne ikke hente dokumentrader for backfill:', error);
      throw error;
    }

    for (const row of data ?? []) {
      issueIdsWithDocuments.add(String(row.issue_id));
    }
  }

  return issueIdsWithDocuments;
}

async function fetchIssueRowsForBackfill(
  service: ReturnType<typeof getServiceSupabase>,
  issueIds: string[],
): Promise<Array<{ id: string; first_seen_at: string | null; detail_json: unknown }>> {
  const rows: Array<{ id: string; first_seen_at: string | null; detail_json: unknown }> = [];

  for (const chunk of chunkIssueIds(issueIds)) {
    const { data, error } = await service
      .from('stortinget_issues')
      .select('id, first_seen_at, detail_json')
      .in('id', chunk);

    if (error) {
      console.warn('[document-ingest] Kunne ikke hente saker for backfill:', error);
      throw error;
    }

    for (const row of data ?? []) {
      rows.push({
        id: String(row.id),
        first_seen_at: (row.first_seen_at as string | null) ?? null,
        detail_json: row.detail_json,
      });
    }
  }

  return rows;
}

export async function selectSessionIssueIdsMissingDocuments(
  sessionIssueIds: string[],
  limit = SYNC_DOCUMENT_BACKFILL_LIMIT,
  now: Date = new Date(),
): Promise<string[]> {
  if (sessionIssueIds.length === 0) return [];

  let service;
  try {
    service = getServiceSupabase();
  } catch {
    return [];
  }

  const uniqueIds = [...new Set(sessionIssueIds)];

  try {
    const [issueIdsWithDocuments, issueRows] = await Promise.all([
      fetchIssueIdsWithStoredDocuments(service, uniqueIds),
      fetchIssueRowsForBackfill(service, uniqueIds),
    ]);

    const issueIdsWithoutCachedDocumentRefs = collectIssueIdsWithoutCachedDocumentRefs(issueRows);
    const firstSeenAtById = new Map(
      issueRows.map((row) => [row.id, row.first_seen_at] as const),
    );

    const rotationOffset = computeUtcDayIndex(now);

    return pickIssueIdsMissingDocuments({
      candidateIds: uniqueIds,
      issueIdsWithDocuments,
      issueIdsWithoutCachedDocumentRefs,
      firstSeenAtById,
      limit,
      rotationOffset,
    });
  } catch {
    return [];
  }
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