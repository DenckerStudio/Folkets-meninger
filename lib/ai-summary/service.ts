import { getServiceSupabase } from '@/lib/supabase';
import { triggerAiSummaryWebhook } from '@/lib/trigger-ai-summary-webhook';
import { parseForslagJsonb, resolveForslagForSummary } from './forslag';
import { normalizeAiLabels, parseTopicCards } from './normalize-labels';
import type { AiSummary } from './types';

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export type IssueAiSummaryRow = {
  narrative?: string | null;
  who_affected?: string | null;
  how_affected?: string | null;
  topic_cards?: unknown;
  labels?: unknown;
  forslag?: unknown;
  hva?: string | null;
  hvem?: string | null;
  kostnad?: string | null;
};

/** Map DB row to API shape. v2 when narrative is non-empty (who_affected may be empty). */
export function buildAiSummaryFromDbRow(data: IssueAiSummaryRow): AiSummary | null {
  const narrative = data.narrative?.trim();
  const who_affected = data.who_affected?.trim() ?? '';
  const how_affected = data.how_affected?.trim() ?? '';

  if (narrative) {
    const topic_cards = parseTopicCards(data.topic_cards);
    const { forslag, topic_cards: cards } = resolveForslagForSummary(
      parseForslagJsonb(data.forslag),
      topic_cards,
    );
    return {
      version: 2,
      narrative,
      who_affected,
      how_affected,
      forslag,
      topic_cards: cards,
      labels: normalizeAiLabels(data.labels),
      hva: data.hva?.trim() || narrative,
      hvem: data.hvem?.trim() || who_affected,
      kostnad: data.kostnad?.trim() || undefined,
    };
  }

  const hva = data.hva?.trim();
  const hvem = data.hvem?.trim();
  const kostnad = data.kostnad?.trim();
  if (!hva || !hvem || !kostnad) return null;

  return { version: 1, hva, hvem, kostnad };
}

const AI_SUMMARY_COLUMNS =
  'narrative, who_affected, how_affected, topic_cards, labels, hva, hvem, kostnad';
const AI_SUMMARY_COLUMNS_WITH_FORSLAG = `${AI_SUMMARY_COLUMNS}, forslag`;

/**
 * True when PostgREST/Postgres rejects the select because `forslag` is not
 * migrated yet (20261021170000). A missing column is not a missing summary.
 */
export function isMissingForslagColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const row = error as { code?: unknown; message?: unknown; details?: unknown };
  const message = [row.message, row.details]
    .filter((part): part is string => typeof part === 'string')
    .join(' ');
  if (!/forslag/i.test(message)) return false;
  if (row.code === '42703' || row.code === 'PGRST204') return true;
  return /does not exist|schema cache|could not find/i.test(message);
}

async function selectIssueAiSummary(issueId: string, columns: string) {
  const supabase = getServiceSupabase();
  return supabase
    .from('issue_ai_summaries')
    .select(columns)
    .eq('stortinget_issue_id', issueId)
    .maybeSingle();
}

export async function getAiSummaryFromDb(issueId: string): Promise<AiSummary | null> {
  if (!supabaseConfigured()) return null;

  try {
    let { data, error } = await selectIssueAiSummary(issueId, AI_SUMMARY_COLUMNS_WITH_FORSLAG);
    if (error && isMissingForslagColumnError(error)) {
      console.warn(
        '[ai-summary] Kolonnen forslag finnes ikke ennå. Henter lagret sammendrag uten den.',
      );
      ({ data, error } = await selectIssueAiSummary(issueId, AI_SUMMARY_COLUMNS));
    }

    if (error || !data) return null;

    return buildAiSummaryFromDbRow(data as IssueAiSummaryRow);
  } catch (e) {
    console.error('[ai-summary] Kunne ikke hente sammendrag:', e);
    return null;
  }
}

export async function getPopularAiLabels(limit = 200): Promise<string[]> {
  if (!supabaseConfigured()) return [];

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('stortinget_issues')
      .select('ai_labels')
      .neq('ai_labels', '{}');

    if (error || !data) return [];

    const counts = new Map<string, number>();
    for (const row of data) {
      for (const label of row.ai_labels ?? []) {
        const key = String(label).trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'nb'))
      .slice(0, limit)
      .map(([label]) => label);
  } catch (e) {
    console.error('[ai-summary] Kunne ikke hente populære labels:', e);
    return [];
  }
}

export async function getIssueAiLabelsMap(): Promise<Record<string, string[]>> {
  if (!supabaseConfigured()) return {};

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('stortinget_issues')
      .select('id, ai_labels')
      .neq('ai_labels', '{}');

    if (error || !data) return {};

    const map: Record<string, string[]> = {};
    for (const row of data) {
      const labels = normalizeAiLabels(row.ai_labels);
      if (labels.length > 0) {
        map[String(row.id)] = labels;
      }
    }
    return map;
  } catch (e) {
    console.error('[ai-summary] Kunne ikke hente ai_labels:', e);
    return {};
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

  await supabase.from('stortinget_issues').update({ ai_labels: [] }).eq('id', issueId);
}

export type AiSummaryReady = AiSummary & {
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
      .update({ ai_summary_requested_at: new Date().toISOString() })
      .eq('id', issueId);

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
