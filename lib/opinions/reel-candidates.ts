import { listCitizenOpinions } from '@/lib/opinions/service';
import type { OpinionListItem } from '@/lib/opinions/types';
import { buildOpinionReelQuestion, OPINION_REEL_MIN_ENGAGEMENT } from '@/lib/opinions/reel-question';
import { getServiceSupabase } from '@/lib/supabase';
import { routes } from '@/lib/routes';

export { buildOpinionReelQuestion, OPINION_REEL_MIN_ENGAGEMENT };

/**
 * Popular opinions that are linked to a Stortinget issue and do not yet have a
 * Reel (draft/open/closed) or a poll already derived from them (B6). Admin-only:
 * uses the service role to see drafts the public RLS hides.
 */
export async function listOpinionReelCandidates(limit = 12): Promise<OpinionListItem[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];

  const opinions = await listCitizenOpinions(80);
  const candidates = opinions.filter(
    (opinion) =>
      opinion.stortingetIssueId !== null &&
      opinion.counts.total >= OPINION_REEL_MIN_ENGAGEMENT,
  );
  if (candidates.length === 0) return [];

  const service = getServiceSupabase();
  const issueIds = [...new Set(candidates.map((opinion) => opinion.stortingetIssueId as string))];
  const { data, error } = await service
    .from('polls')
    .select('stortinget_issue_id, source_opinion_id')
    .in('stortinget_issue_id', issueIds)
    .in('status', ['draft', 'open', 'closed']);

  if (error) {
    console.error('listOpinionReelCandidates error:', error.message);
    return [];
  }

  const usedIssues = new Set((data ?? []).map((row) => String(row.stortinget_issue_id)));
  const usedOpinions = new Set(
    (data ?? [])
      .map((row) => (row.source_opinion_id ? String(row.source_opinion_id) : ''))
      .filter(Boolean),
  );

  return candidates
    .filter(
      (opinion) =>
        !usedIssues.has(opinion.stortingetIssueId as string) && !usedOpinions.has(opinion.id),
    )
    .slice(0, limit);
}

/**
 * Creates a system Reel draft from an opinion. The RPC enforces the one-Reel-
 * per-issue rule and validates that the opinion is linked to an issue.
 */
export async function createOpinionReelDraft(opinion: OpinionListItem): Promise<string> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Tjenesten er ikke konfigurert');
  }
  if (!opinion.stortingetIssueId) {
    throw new Error('Meningen er ikke knyttet til en sak');
  }

  const service = getServiceSupabase();
  const { data, error } = await service.rpc('create_poll_draft_from_opinion', {
    p_opinion_id: opinion.id,
    p_title: buildOpinionReelQuestion(opinion),
    p_neutral_summary: opinion.body.slice(0, 400),
    p_source_urls: [{ label: 'Folkets meninger', url: routes.opinion(opinion.id) }],
    p_generation_metadata: {
      source_type: 'citizen_opinion',
      user_initiated: true,
      source_opinion_id: opinion.id,
      source_issue_id: opinion.stortingetIssueId,
    },
  });

  if (error) throw error;
  return String(data);
}
