import { BLOG_PUBLIC_STATS_MIN_COUNT } from '@/lib/blog/constants';
import { parseFolkTotals } from '@/lib/chat/vote-alignment';
import {
  fetchStortingetHoringById,
  getHoringTitle,
  type StortingetHoring,
} from '@/lib/stortinget-horinger';
import { getAnonSupabase } from '@/lib/supabase';
import { getSakerWithCache } from '@/lib/stortinget-saker-cache';
import { routes } from '@/lib/routes';

export type BlogRelatedSakCard = {
  id: string;
  title: string;
  href: string;
  folkTotal: number | null;
};

export type BlogRelatedHoringCard = {
  id: string;
  title: string;
  href: string;
  subtitle: string | null;
};

async function folkTotalForSak(issueId: string): Promise<number> {
  try {
    const supabase = getAnonSupabase();
    const { data, error } = await supabase.rpc('get_issue_vote_totals', { p_issue_id: issueId });
    if (error) return 0;
    return parseFolkTotals(data).total;
  } catch {
    return 0;
  }
}

export async function loadBlogRelatedSakCards(ids: string[]): Promise<BlogRelatedSakCard[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, 8);
  if (unique.length === 0) return [];

  const saker = await getSakerWithCache({ includeAll: true, preferDb: true }).catch(() => []);
  const byId = new Map(saker.map((sak) => [String(sak.id), sak]));

  const cards: BlogRelatedSakCard[] = [];
  for (const id of unique) {
    const sak = byId.get(id);
    const title = sak?.title?.trim() || `Stortingssak ${id}`;
    const total = await folkTotalForSak(id);
    cards.push({
      id,
      title,
      href: routes.sak(id),
      folkTotal: total >= BLOG_PUBLIC_STATS_MIN_COUNT ? total : null,
    });
  }
  return cards;
}

export async function loadBlogRelatedHoringCards(ids: string[]): Promise<BlogRelatedHoringCard[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, 8);
  if (unique.length === 0) return [];

  const cards: BlogRelatedHoringCard[] = [];
  for (const id of unique) {
    let hearing: StortingetHoring | null = null;
    try {
      hearing = await fetchStortingetHoringById(id);
    } catch {
      hearing = null;
    }
    const title = hearing ? getHoringTitle(hearing) : `Høring ${id}`;
    const komite = hearing?.komite?.navn?.trim();
    cards.push({
      id,
      title,
      href: routes.horing(id),
      subtitle: komite ?? null,
    });
  }
  return cards;
}
