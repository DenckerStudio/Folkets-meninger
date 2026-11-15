import { unstable_cache } from 'next/cache';
import { getChatRagRpcClient } from '@/lib/chat/rag-rpc-client';
import { resolveSakStatusFromSources, getSakTreatmentLabel, type SakTreatmentStatus } from '@/lib/sak-status';

export type SimilarSakListItem = {
  id: string;
  title: string;
  sesjon: string | null;
  status: SakTreatmentStatus;
  statusLabel: string;
};

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

    return data.flatMap((row) => {
      const record = row as Record<string, unknown>;
      const sakId = String(record.id ?? '').trim();
      if (!sakId) return [];

      const title = String(record.title ?? '').trim() || sakId;
      const sesjonRaw = record.sak_sesjon;
      const sesjon =
        typeof sesjonRaw === 'string' && sesjonRaw.trim() ? sesjonRaw.trim() : null;

      const status = resolveSakStatusFromSources({
        ferdigbehandlet: typeof record.ferdigbehandlet === 'boolean' ? record.ferdigbehandlet : null,
      });

      return [
        {
          id: sakId,
          title,
          sesjon,
          status,
          statusLabel: getSakTreatmentLabel(status),
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