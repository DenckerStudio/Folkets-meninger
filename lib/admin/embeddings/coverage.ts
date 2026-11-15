import { getServiceSupabase } from '@/lib/supabase';
import { postgrestErrorCode } from '@/lib/admin/postgrest-error';
import { isMissingAnalyticsRpc } from '@/lib/admin/analytics/overview';

export type EmbeddingModelRow = {
  modelTag: string;
  chunkCount: number;
};

export type AdminEmbeddingCoverage = {
  ready: boolean;
  generatedAt: string | null;
  legacy: {
    dimension: number;
    modelTag: string;
    ready: number;
    pending: number;
    failed: number;
    lastReadyAt: string | null;
  } | null;
  v2: {
    dimension: number;
    ready: number;
    pending: number;
    failed: number;
    missingVector: number;
    models: EmbeddingModelRow[];
    lastRunAt: string | null;
  } | null;
  issues: {
    total: number;
    withChunks: number;
    withoutChunks: number;
    shareWithoutChunks: number;
  } | null;
  backlogHealth: Record<string, unknown> | null;
};

export const embeddingCoverageNotReady: AdminEmbeddingCoverage = {
  ready: false,
  generatedAt: null,
  legacy: null,
  v2: null,
  issues: null,
  backlogHealth: null,
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

function mapModels(rows: unknown): EmbeddingModelRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      modelTag: String(r.model_tag ?? r.modelTag ?? 'ukjent'),
      chunkCount: asNumber(r.chunk_count ?? r.chunkCount),
    };
  });
}

export function mapAdminEmbeddingCoverage(raw: Record<string, unknown>): AdminEmbeddingCoverage {
  const legacyRaw = raw.legacy;
  const v2Raw = raw.v2;
  const issuesRaw = raw.issues;

  const legacy =
    legacyRaw && typeof legacyRaw === 'object'
      ? {
          dimension: asNumber((legacyRaw as Record<string, unknown>).dimension),
          modelTag: String((legacyRaw as Record<string, unknown>).modelTag ?? 'nomic-embed-text'),
          ready: asNumber((legacyRaw as Record<string, unknown>).ready),
          pending: asNumber((legacyRaw as Record<string, unknown>).pending),
          failed: asNumber((legacyRaw as Record<string, unknown>).failed),
          lastReadyAt: asNullableString((legacyRaw as Record<string, unknown>).lastReadyAt),
        }
      : null;

  const v2 =
    v2Raw && typeof v2Raw === 'object'
      ? {
          dimension: asNumber((v2Raw as Record<string, unknown>).dimension),
          ready: asNumber((v2Raw as Record<string, unknown>).ready),
          pending: asNumber((v2Raw as Record<string, unknown>).pending),
          failed: asNumber((v2Raw as Record<string, unknown>).failed),
          missingVector: asNumber((v2Raw as Record<string, unknown>).missingVector),
          models: mapModels((v2Raw as Record<string, unknown>).models),
          lastRunAt: asNullableString((v2Raw as Record<string, unknown>).lastRunAt),
        }
      : null;

  const issues =
    issuesRaw && typeof issuesRaw === 'object'
      ? {
          total: asNumber((issuesRaw as Record<string, unknown>).total),
          withChunks: asNumber((issuesRaw as Record<string, unknown>).withChunks),
          withoutChunks: asNumber((issuesRaw as Record<string, unknown>).withoutChunks),
          shareWithoutChunks: asNumber((issuesRaw as Record<string, unknown>).shareWithoutChunks),
        }
      : null;

  const backlog =
    raw.backlogHealth && typeof raw.backlogHealth === 'object'
      ? (raw.backlogHealth as Record<string, unknown>)
      : null;

  return {
    ready: true,
    generatedAt: asNullableString(raw.generatedAt),
    legacy,
    v2,
    issues,
    backlogHealth: backlog,
  };
}

export async function loadAdminEmbeddingCoverage(
  adminUserId: string,
): Promise<AdminEmbeddingCoverage> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('admin_get_embedding_coverage', {
    p_admin_user_id: adminUserId,
  });

  if (error) {
    if (isMissingAnalyticsRpc(error)) {
      return embeddingCoverageNotReady;
    }
    const code = postgrestErrorCode(error);
    throw new Error(
      code
        ? `Kunne ikke laste embedding-dekning (kode ${code})`
        : 'Kunne ikke laste embedding-dekning',
    );
  }

  if (!data || typeof data !== 'object') {
    return embeddingCoverageNotReady;
  }

  return mapAdminEmbeddingCoverage(data as Record<string, unknown>);
}