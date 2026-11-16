import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { getUserStanceCount } from '@/lib/stances/service';
import { getValgomatForSession } from '@/lib/valgomat/service';
import { readUserSubscription } from '@/lib/stemme-plus/service';
import { isStemmePlusActive } from '@/lib/stemme-plus/tier';

export type OverviewStat<T> =
  | { status: 'ok'; value: T }
  | { status: 'unavailable' };

export type MinSideOverviewSnapshot = {
  stanceCount: OverviewStat<number>;
  pollVoteCount: OverviewStat<number>;
  opinionCount: OverviewStat<number>;
  valgomatStanceCount: OverviewStat<number>;
  valgomatComparableIssues: OverviewStat<number>;
  valgomatReady: OverviewStat<boolean>;
  stemmePlusActive: OverviewStat<boolean>;
};

async function loadStanceCount(service: ReturnType<typeof getServiceSupabase>, userId: string) {
  try {
    const value = await getUserStanceCount(service, userId);
    return { status: 'ok' as const, value };
  } catch {
    return { status: 'unavailable' as const };
  }
}

async function loadValgomat(session: Awaited<ReturnType<typeof getServerSupabase>>) {
  try {
    const valgomat = await getValgomatForSession(session);
    return {
      stanceCount: { status: 'ok' as const, value: valgomat.stance_count },
      comparableIssues: { status: 'ok' as const, value: valgomat.comparable_issue_count },
      ready: {
        status: 'ok' as const,
        value:
          valgomat.stance_count > 0 &&
          valgomat.comparable_issue_count > 0 &&
          valgomat.partisamsvar.length > 0,
      },
    };
  } catch {
    return {
      stanceCount: { status: 'unavailable' as const },
      comparableIssues: { status: 'unavailable' as const },
      ready: { status: 'unavailable' as const },
    };
  }
}

async function loadPollVoteCount(
  service: ReturnType<typeof getServiceSupabase>,
  userId: string,
) {
  try {
    const pollReceiptRes = await service
      .from('poll_vote_receipts')
      .select('poll_id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (typeof pollReceiptRes.count === 'number') {
      return { status: 'ok' as const, value: pollReceiptRes.count };
    }
    const voteHistoryRes = await service.rpc('get_user_vote_history', { p_user_id: userId });
    if (voteHistoryRes.error) {
      return { status: 'unavailable' as const };
    }
    const value = Array.isArray(voteHistoryRes.data) ? voteHistoryRes.data.length : 0;
    return { status: 'ok' as const, value };
  } catch {
    return { status: 'unavailable' as const };
  }
}

async function loadOpinionCount(
  service: ReturnType<typeof getServiceSupabase>,
  userId: string,
) {
  try {
    const opinionRes = await service
      .from('citizen_opinions')
      .select('id', { count: 'exact', head: true })
      .eq('author_user_id', userId);
    if (typeof opinionRes.count !== 'number' || opinionRes.error) {
      return { status: 'unavailable' as const };
    }
    return { status: 'ok' as const, value: opinionRes.count };
  } catch {
    return { status: 'unavailable' as const };
  }
}

async function loadStemmePlus(session: Awaited<ReturnType<typeof getServerSupabase>>, userId: string) {
  try {
    const subscription = await readUserSubscription(session, userId);
    return { status: 'ok' as const, value: isStemmePlusActive(subscription) };
  } catch {
    return { status: 'unavailable' as const };
  }
}

export async function loadMinSideOverview(userId: string): Promise<MinSideOverviewSnapshot> {
  const session = await getServerSupabase();
  const service = getServiceSupabase();

  const [stanceCount, valgomat, pollVoteCount, opinionCount, stemmePlusActive] = await Promise.all([
    loadStanceCount(service, userId),
    loadValgomat(session),
    loadPollVoteCount(service, userId),
    loadOpinionCount(service, userId),
    loadStemmePlus(session, userId),
  ]);

  return {
    stanceCount,
    pollVoteCount,
    opinionCount,
    valgomatStanceCount: valgomat.stanceCount,
    valgomatComparableIssues: valgomat.comparableIssues,
    valgomatReady: valgomat.ready,
    stemmePlusActive,
  };
}