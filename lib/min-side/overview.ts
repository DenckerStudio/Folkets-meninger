import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { getUserStanceCount } from '@/lib/stances/service';
import { getValgomatForSession } from '@/lib/valgomat/service';
import { readUserSubscription } from '@/lib/stemme-plus/service';
import { isStemmePlusActive } from '@/lib/stemme-plus/tier';

export type MinSideOverviewSnapshot = {
  stanceCount: number;
  pollVoteCount: number;
  opinionCount: number;
  valgomatStanceCount: number;
  valgomatComparableIssues: number;
  valgomatReady: boolean;
  stemmePlusActive: boolean;
};

export type MinSideOverviewLoadResult =
  | { ok: true; data: MinSideOverviewSnapshot }
  | { ok: false };

export async function loadMinSideOverview(userId: string): Promise<MinSideOverviewLoadResult> {
  try {
    const session = await getServerSupabase();
    const service = getServiceSupabase();

    const [stanceCount, valgomat, subscription, voteHistoryRes, opinionRes, pollReceiptRes] =
      await Promise.all([
        getUserStanceCount(service, userId),
        getValgomatForSession(session),
        readUserSubscription(session, userId),
        service.rpc('get_user_vote_history', { p_user_id: userId }),
        service
          .from('citizen_opinions')
          .select('id', { count: 'exact', head: true })
          .eq('author_user_id', userId),
        service
          .from('poll_vote_receipts')
          .select('poll_id', { count: 'exact', head: true })
          .eq('user_id', userId),
      ]);

    const pollVoteCount =
      typeof pollReceiptRes.count === 'number'
        ? pollReceiptRes.count
        : Array.isArray(voteHistoryRes.data)
          ? voteHistoryRes.data.length
          : 0;

    const opinionCount = typeof opinionRes.count === 'number' ? opinionRes.count : 0;

    return {
      ok: true,
      data: {
        stanceCount,
        pollVoteCount,
        opinionCount,
        valgomatStanceCount: valgomat.stance_count,
        valgomatComparableIssues: valgomat.comparable_issue_count,
        valgomatReady:
          valgomat.stance_count > 0 && valgomat.comparable_issue_count > 0 && valgomat.partisamsvar.length > 0,
        stemmePlusActive: isStemmePlusActive(subscription),
      },
    };
  } catch {
    return { ok: false };
  }
}