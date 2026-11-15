import { getServiceSupabase } from '@/lib/supabase';
import { postgrestErrorCode } from '@/lib/admin/postgrest-error';
import { isMissingAnalyticsRpc } from '@/lib/admin/analytics/overview';

export type AdminKildeRagRow = {
  sourceType: string;
  corpus: string;
  documentCount: number;
  chunkCount: number;
  chunks7d: number;
  chunks30d: number;
  chunks90d: number;
  lastChunkAt: string | null;
};

export type AdminKildeCaptureRow = {
  sourceType: string;
  sourceCount: number;
  sources7d: number;
  sources30d: number;
  sources90d: number;
  lastFetchedAt: string | null;
};

export type AdminKildeOverview = {
  ready: boolean;
  generatedAt: string | null;
  lastChunkAt: string | null;
  lastIssueDocumentFetchAt: string | null;
  lastHearingDocumentUpdateAt: string | null;
  ragBySourceType: AdminKildeRagRow[];
  captureBySourceType: AdminKildeCaptureRow[];
};

export const kildeOverviewNotReady: AdminKildeOverview = {
  ready: false,
  generatedAt: null,
  lastChunkAt: null,
  lastIssueDocumentFetchAt: null,
  lastHearingDocumentUpdateAt: null,
  ragBySourceType: [],
  captureBySourceType: [],
};

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function mapRagRows(rows: unknown): AdminKildeRagRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      sourceType: String(r.source_type ?? r.sourceType ?? 'ukjent'),
      corpus: String(r.corpus ?? 'stortinget_sak'),
      documentCount: asNumber(r.document_count ?? r.documentCount),
      chunkCount: asNumber(r.chunk_count ?? r.chunkCount),
      chunks7d: asNumber(r.chunks_7d ?? r.chunks7d),
      chunks30d: asNumber(r.chunks_30d ?? r.chunks30d),
      chunks90d: asNumber(r.chunks_90d ?? r.chunks90d),
      lastChunkAt: asNullableString(r.last_chunk_at ?? r.lastChunkAt),
    };
  });
}

function mapCaptureRows(rows: unknown): AdminKildeCaptureRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      sourceType: String(r.source_type ?? r.sourceType ?? 'ukjent'),
      sourceCount: asNumber(r.source_count ?? r.sourceCount),
      sources7d: asNumber(r.sources_7d ?? r.sources7d),
      sources30d: asNumber(r.sources_30d ?? r.sources30d),
      sources90d: asNumber(r.sources_90d ?? r.sources90d),
      lastFetchedAt: asNullableString(r.last_fetched_at ?? r.lastFetchedAt),
    };
  });
}

export function mapAdminKildeOverview(raw: Record<string, unknown>): AdminKildeOverview {
  return {
    ready: true,
    generatedAt: asNullableString(raw.generatedAt),
    lastChunkAt: asNullableString(raw.lastChunkAt),
    lastIssueDocumentFetchAt: asNullableString(raw.lastIssueDocumentFetchAt),
    lastHearingDocumentUpdateAt: asNullableString(raw.lastHearingDocumentUpdateAt),
    ragBySourceType: mapRagRows(raw.ragBySourceType),
    captureBySourceType: mapCaptureRows(raw.captureBySourceType),
  };
}

export async function loadAdminKildeOverview(adminUserId: string): Promise<AdminKildeOverview> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('admin_get_kilde_overview', {
    p_admin_user_id: adminUserId,
  });

  if (error) {
    if (isMissingAnalyticsRpc(error)) {
      return kildeOverviewNotReady;
    }
    const code = postgrestErrorCode(error);
    throw new Error(
      code ? `Kunne ikke laste kildeoversikt (kode ${code})` : 'Kunne ikke laste kildeoversikt',
    );
  }

  if (!data || typeof data !== 'object') {
    return kildeOverviewNotReady;
  }

  return mapAdminKildeOverview(data as Record<string, unknown>);
}