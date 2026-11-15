import type { SupabaseClient } from '@supabase/supabase-js';
import { isIssueStance, type IssueStance } from '@/lib/stances/types';
import type { EngagedUserStance } from '@/lib/valgomat/alignment';

type StanceRow = {
  stortinget_issue_id: string;
  stance: string;
  updated_at: string;
  stortinget_issues: { title: string | null } | { title: string | null }[] | null;
};

function engagedStance(value: string): value is Exclude<IssueStance, 'ikke_interessert'> {
  return value === 'enig' || value === 'uenig';
}

function titleFromJoin(
  joined: StanceRow['stortinget_issues'],
): string | null {
  if (!joined) return null;
  if (Array.isArray(joined)) {
    return joined[0]?.title ?? null;
  }
  return joined.title ?? null;
}

/** Reads only the caller's rows via RLS `issue_stances_select_own`. */
export async function loadEngagedStancesForSession(
  supabase: SupabaseClient,
): Promise<EngagedUserStance[]> {
  const { data, error } = await supabase
    .from('issue_stances')
    .select('stortinget_issue_id, stance, updated_at, stortinget_issues(title)')
    .in('stance', ['enig', 'uenig'])
    .order('updated_at', { ascending: false });

  if (error || !Array.isArray(data)) {
    throw new Error(error?.message ?? 'Kunne ikke lese holdninger');
  }

  const rows = data as StanceRow[];
  const out: EngagedUserStance[] = [];

  for (const row of rows) {
    if (!isIssueStance(row.stance) || !engagedStance(row.stance)) continue;
    out.push({
      stortinget_issue_id: row.stortinget_issue_id,
      title: titleFromJoin(row.stortinget_issues),
      stance: row.stance,
      updated_at: row.updated_at,
    });
  }

  return out;
}