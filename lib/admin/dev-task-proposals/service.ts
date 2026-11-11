import 'server-only';

import { getServerSupabase } from '@/lib/supabase-server';
import type { DevTaskProposalRow } from '@/lib/admin/dev-task-proposals/types';

const SELECT_COLS =
  'id, title, body, source, signal_ref, dedupe_key, risk, status, decided_by, decided_at, pr_url, slack_ts, slack_posted_at, created_at, updated_at';

export async function listDevTaskProposalsForAdmin(): Promise<
  { ok: true; proposals: DevTaskProposalRow[] } | { ok: false; error: string }
> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('dev_task_proposals')
    .select(SELECT_COLS)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') {
      return { ok: false, error: 'Tabellen finnes ikke ennå i databasen.' };
    }
    console.error('listDevTaskProposalsForAdmin', error);
    return { ok: false, error: 'Kunne ikke hente oppgaver.' };
  }

  return { ok: true, proposals: (data ?? []) as DevTaskProposalRow[] };
}

export async function applyDevTaskProposalDecision(
  proposalId: string,
  patch: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('dev_task_proposals')
    .update(patch)
    .eq('id', proposalId)
    .eq('status', 'til_godkjenning')
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') {
      return { ok: false, status: 503, error: 'Tabellen finnes ikke ennå i databasen.' };
    }
    console.error('applyDevTaskProposalDecision', error);
    return { ok: false, status: 500, error: 'Kunne ikke oppdatere forslaget.' };
  }

  if (!data) {
    return {
      ok: false,
      status: 409,
      error: 'Forslaget finnes ikke eller er allerede behandlet.',
    };
  }

  return { ok: true };
}
