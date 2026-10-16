import { getServiceSupabase } from './supabase';
import type { SakVoteTotals } from './stortinget';

type BatchRow = { for?: number; against?: number; abstain?: number; total?: number };

type StanceRow = { stortinget_issue_id: string; stance: string };

async function aggregateStanceRowsFallback(
  issueIds: string[],
): Promise<Record<string, SakVoteTotals>> {
  const result: Record<string, SakVoteTotals> = {};
  if (issueIds.length === 0) {
    return result;
  }

  const service = getServiceSupabase();
  const { data, error } = await service
    .from('issue_stances')
    .select('stortinget_issue_id, stance')
    .in('stortinget_issue_id', issueIds);

  if (error || !Array.isArray(data)) {
    if (error) {
      console.error('issue_stances fallback error:', error.message);
    }
    return result;
  }

  for (const row of data as StanceRow[]) {
    const id = row.stortinget_issue_id;
    if (!result[id]) {
      result[id] = { for: 0, against: 0, abstain: 0, total: 0 };
    }
    const bucket = result[id];
    if (row.stance === 'enig') {
      bucket.for += 1;
      bucket.total += 1;
    } else if (row.stance === 'uenig') {
      bucket.against += 1;
      bucket.total += 1;
    } else if (row.stance === 'ikke_interessert') {
      bucket.abstain += 1;
    }
  }

  return result;
}

function mapBatchPayload(
  data: unknown,
): Record<string, SakVoteTotals> {
  const result: Record<string, SakVoteTotals> = {};
  if (!data || typeof data !== 'object') {
    return result;
  }

  const batch = data as Record<string, BatchRow>;
  for (const [issueId, counts] of Object.entries(batch)) {
    const forCount = counts.for ?? 0;
    const againstCount = counts.against ?? 0;
    const abstainCount = counts.abstain ?? 0;
    result[issueId] = {
      for: forCount,
      against: againstCount,
      abstain: abstainCount,
      total: counts.total ?? forCount + againstCount + abstainCount,
    };
  }

  return result;
}

/**
 * Participation counts from issue_stances (enig/uenig/ikke_interessert).
 * Legacy citizen_votes are no longer used for list/landing surfaces.
 */
export async function getParticipationTotalsBatch(
  issueIds: string[],
): Promise<Record<string, SakVoteTotals>> {
  const result: Record<string, SakVoteTotals> = {};
  if (issueIds.length === 0 || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return result;
  }

  try {
    const service = getServiceSupabase();
    const { data, error } = await service.rpc('get_stance_totals_batch', {
      p_issue_ids: issueIds,
    });

    if (!error && data) {
      return mapBatchPayload(data);
    }

    if (error) {
      const missingRpc =
        error.code === 'PGRST202' ||
        error.message?.includes('get_stance_totals_batch') ||
        error.message?.includes('Could not find the function');
      if (!missingRpc) {
        console.error('get_stance_totals_batch error:', error.message);
        return result;
      }
    }
  } catch (e) {
    console.error('Failed to fetch stance totals:', e);
    return result;
  }

  return aggregateStanceRowsFallback(issueIds);
}
