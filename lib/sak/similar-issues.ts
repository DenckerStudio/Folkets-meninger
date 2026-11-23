import { unstable_cache } from 'next/cache';
import { getChatRagRpcClient } from '@/lib/chat/rag-rpc-client';
import { resolveSakStatusFromSources, type SakTreatmentStatus } from '@/lib/sak-status';
import { sakStatusOrOutcomeLabel } from '@/lib/sak/sak-outcome';
import { parseSimilarSakFacets, type SimilarSakFacets } from '@/lib/sak/similar-issues-labels';
import { loadSimilarSakerWithStatus, type SimilarSakerLoadResult } from '@/lib/sak/similar-issues-load';

export type SimilarSakListItem = {
  id: string;
  title: string;
  sesjon: string | null;
  status: SakTreatmentStatus;
  /** «Vedtatt» / «Ikke vedtatt» når Stortingets tekst sier det, ellers «Ferdigbehandlet» / «Under behandling». */
  statusLabel: string;
  facets?: SimilarSakFacets;
};

type IssueDetailRow = {
  id?: unknown;
  status?: unknown;
  sak_kind?: unknown;
  kortvedtak?: unknown;
  vedtakstekst?: unknown;
  komite_navn?: unknown;
  komite_raw?: unknown;
  emner?: unknown;
};

/** Én spørring for alle treff (ingen N+1): kun feltene vi viser, hentet fra detail_json-stier. */
const ISSUE_DETAIL_SELECT = [
  'id',
  'status',
  'sak_kind',
  'kortvedtak:detail_json->>kortvedtak',
  'vedtakstekst:detail_json->>vedtakstekst',
  'komite_navn:detail_json->komite->>navn',
  'komite_raw:detail_json->>komite',
  'emner:detail_json->emne_liste',
].join(', ');

async function loadIssueDetailRows(
  rpc: NonNullable<ReturnType<typeof getChatRagRpcClient>>,
  ids: readonly string[],
): Promise<Map<string, IssueDetailRow>> {
  const map = new Map<string, IssueDetailRow>();
  if (ids.length === 0) return map;
  try {
    const { data, error } = await rpc.from('stortinget_issues').select(ISSUE_DETAIL_SELECT).in('id', [...ids]);
    if (error || !Array.isArray(data)) return map;
    for (const row of data as unknown as IssueDetailRow[]) {
      const id = String(row.id ?? '').trim();
      if (id) map.set(id, row);
    }
  } catch {
    return map;
  }
  return map;
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function shouldShowSimilarSakerSection(items: SimilarSakListItem[] | null | undefined): boolean {
  return Array.isArray(items) && items.length > 0;
}

export { shouldShowSimilarSakerSection };

async function fetchSimilarSakerUncached(issueId: string): Promise<SimilarSakListItem[]> {
  const id = issueId.trim();
  if (!id) return [];

  const rpc = getChatRagRpcClient();
  if (!rpc?.rpc) return [];

  try {
    const { data, error } = await rpc.rpc('search_similar_stortinget_issues', {
      p_issue_id: id,
      match_count: 5,
    });

    if (error || !Array.isArray(data) || data.length === 0) {
      return [];
    }

    const detailRows = await loadIssueDetailRows(
      rpc,
      data.map((row) => String((row as Record<string, unknown>).id ?? '').trim()).filter(Boolean),
    );

    return data.flatMap((row) => {
      const record = row as Record<string, unknown>;
      const sakId = String(record.id ?? '').trim();
      if (!sakId) return [];

      const title = String(record.title ?? '').trim() || sakId;
      const sesjonRaw = record.sak_sesjon;
      const sesjon =
        typeof sesjonRaw === 'string' && sesjonRaw.trim() ? sesjonRaw.trim() : null;

      const detail = detailRows.get(sakId);
      const status = resolveSakStatusFromSources({
        ferdigbehandlet: typeof record.ferdigbehandlet === 'boolean' ? record.ferdigbehandlet : null,
        cachedStatus: textOrNull(detail?.status),
      });

      return [
        {
          id: sakId,
          title,
          sesjon,
          status,
          statusLabel: sakStatusOrOutcomeLabel({
            status,
            kortvedtak: textOrNull(detail?.kortvedtak),
            vedtakstekst: textOrNull(detail?.vedtakstekst),
          }),
          ...(detail ? { facets: parseSimilarSakFacets(detail) } : {}),
        },
      ];
    });
  } catch {
    return [];
  }
}

export function fetchSimilarSaker(issueId: string): Promise<SimilarSakListItem[]> {
  const id = issueId.trim();
  if (!id) return Promise.resolve([]);

  return unstable_cache(
    () => fetchSimilarSakerUncached(id),
    ['similar-stortinget-issues', id],
    { revalidate: 3600 },
  )();
}

export function fetchSimilarSakerWithStatus(issueId: string): Promise<SimilarSakerLoadResult> {
  const id = issueId.trim();
  if (!id) return Promise.resolve({ status: 'ok', items: [] });

  return unstable_cache(
    () => loadSimilarSakerWithStatus(id),
    ['similar-stortinget-issues-status', id],
    { revalidate: 3600 },
  )();
}