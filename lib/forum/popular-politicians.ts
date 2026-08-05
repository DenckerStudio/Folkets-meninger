import { getServiceSupabase } from '@/lib/supabase';
import { getRepresentanterForPeriode } from '@/lib/stortinget';
import { politicianContextItem, type ForumContextItem } from '@/lib/forum/context';

type PoliticianCount = {
  name: string;
  party: string | null;
  count: number;
};

function bump(
  counts: Map<string, PoliticianCount>,
  id: string,
  name: string,
  party: string | null,
) {
  const existing = counts.get(id);
  counts.set(id, {
    name: existing?.name ?? name,
    party: existing?.party ?? party,
    count: (existing?.count ?? 0) + 1,
  });
}

export async function getPopularPoliticians(limit = 5): Promise<ForumContextItem[]> {
  const counts = new Map<string, PoliticianCount>();

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const service = getServiceSupabase();
    const { data } = await service
      .from('forum_threads')
      .select('context_items')
      .order('created_at', { ascending: false })
      .limit(500);

    for (const row of data ?? []) {
      const items = Array.isArray(row.context_items) ? row.context_items : [];
      for (const raw of items) {
        if (!raw || typeof raw !== 'object') continue;
        const item = raw as Record<string, unknown>;
        if (item.kind !== 'politician' || typeof item.id !== 'string') continue;
        const name = typeof item.title === 'string' ? item.title : 'Politiker';
        const party =
          typeof item.meta === 'string'
            ? item.meta
            : typeof item.subtitle === 'string'
              ? item.subtitle
              : null;
        bump(counts, item.id, name, party);
      }
    }
  }

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit);

  if (ranked.length < limit) {
    const reps = await getRepresentanterForPeriode();
    for (const rep of reps) {
      if (ranked.length >= limit) break;
      const id = String(rep.id);
      if (ranked.some(([existingId]) => existingId === id)) continue;
      ranked.push([
        id,
        {
          name: `${rep.fornavn} ${rep.etternavn}`.trim(),
          party: rep.parti?.navn ?? null,
          count: 0,
        },
      ]);
    }
  }

  return ranked.map(([id, value]) => politicianContextItem(id, value.name, value.party));
}
