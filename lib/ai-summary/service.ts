import { getServiceSupabase } from '@/lib/supabase';
import { triggerAiSummaryWebhook } from '@/lib/trigger-ai-summary-webhook';
import type { SummaryCards } from './types';

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function getAiSummaryFromDb(
  issueId: string
): Promise<SummaryCards | null> {
  if (!supabaseConfigured()) return null;

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('issue_ai_summaries')
      .select('hva, hvem, kostnad')
      .eq('stortinget_issue_id', issueId)
      .maybeSingle();

    if (error || !data) return null;

    const hva = data.hva?.trim();
    const hvem = data.hvem?.trim();
    const kostnad = data.kostnad?.trim();
    if (!hva || !hvem || !kostnad) return null;

    return { hva, hvem, kostnad };
  } catch (e) {
    console.error('[ai-summary] Kunne ikke hente sammendrag:', e);
    return null;
  }
}

export async function deleteAiSummary(issueId: string): Promise<void> {
  if (!supabaseConfigured()) return;

  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from('issue_ai_summaries')
    .delete()
    .eq('stortinget_issue_id', issueId);

  if (error) {
    console.error('[ai-summary] Kunne ikke slette sammendrag:', error);
  }
}

export type AiSummaryReady = SummaryCards & {
  status: 'ready';
  cached: true;
};

export type AiSummaryPending = {
  status: 'pending';
  retry_after_seconds: number;
};

export type AiSummaryApiResult = AiSummaryReady | AiSummaryPending;

const WEBHOOK_COOLDOWN_MS = 60 * 60 * 1000;

async function markAiSummaryRequested(issueId: string): Promise<boolean> {
  if (!supabaseConfigured()) return false;

  try {
    const supabase = getServiceSupabase();
    const cutoff = new Date(Date.now() - WEBHOOK_COOLDOWN_MS).toISOString();

    const { data: row } = await supabase
      .from('stortinget_issues')
      .select('ai_summary_requested_at')
      .eq('id', issueId)
      .maybeSingle();

    if (row?.ai_summary_requested_at && row.ai_summary_requested_at >= cutoff) {
      return false;
    }

    await supabase
      .from('stortinget_issues')
      .upsert(
        {
          id: issueId,
          ai_summary_requested_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    return true;
  } catch (e) {
    console.error('[ai-summary] Kunne ikke markere webhook-forespørsel:', e);
    return true;
  }
}

export async function resolveAiSummaryForApi(
  issueId: string,
  options: { triggerIfMissing?: boolean } = {}
): Promise<AiSummaryApiResult> {
  const existing = await getAiSummaryFromDb(issueId);
  if (existing) {
    return { status: 'ready', ...existing, cached: true };
  }

  if (options.triggerIfMissing) {
    const shouldTrigger = await markAiSummaryRequested(issueId);
    if (shouldTrigger) {
      triggerAiSummaryWebhook(issueId);
    }
  }

  return { status: 'pending', retry_after_seconds: 15 };
}
