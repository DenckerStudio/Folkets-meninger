import { getChatRagRpcClient } from '@/lib/chat/rag-rpc-client';
import { resolveSakStatusFromSources, type SakTreatmentStatus } from '@/lib/sak-status';
import { sakStatusOrOutcomeLabel } from '@/lib/sak/sak-outcome';
import { parseSimilarSakFacets } from '@/lib/sak/similar-issues-labels';
import type { SimilarSakListItem } from '@/lib/sak/similar-issues';

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

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

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

export type SimilarSakerLoadResult =
  | { status: 'ok'; items: SimilarSakListItem[] }
  | { status: 'error' };

/** Uncached load: skiller tom liste (ok) fra reell feil. */
export async function loadSimilarSakerWithStatus(issueId: string): Promise<SimilarSakerLoadResult> {
  const id = issueId.trim();
  if (!id) return { status: 'ok', items: [] };

  const rpc = getChatRagRpcClient();
  if (!rpc?.rpc) return { status: 'error' };

  try {
    const { data, error } = await rpc.rpc('search_similar_stortinget_issues', {
      p_issue_id: id,
      match_count: 5,
    });

    if (error) return { status: 'error' };
    if (!Array.isArray(data) || data.length === 0) {
      return { status: 'ok', items: [] };
    }

    const detailRows = await loadIssueDetailRows(
      rpc,
      data.map((row) => String((row as Record<string, unknown>).id ?? '').trim()).filter(Boolean),
    );

    const items = data.flatMap((row) => {
      const record = row as Record<string, unknown>;
      const sakId = String(record.id ?? '').trim();
      if (!sakId) return [];

      const title = String(record.title ?? '').trim() || sakId;
      const sesjonRaw = record.sak_sesjon;
      const sesjon =
        typeof sesjonRaw === 'string' && sesjonRaw.trim() ? sesjonRaw.trim() : null;

      const detail = detailRows.get(sakId);
      const status: SakTreatmentStatus = resolveSakStatusFromSources({
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

    return { status: 'ok', items };
  } catch {
    return { status: 'error' };
  }
}

export const SIMILAR_ISSUES_ERROR_MESSAGE = 'Kunne ikke hente liknende saker';