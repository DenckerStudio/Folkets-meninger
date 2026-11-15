import { getServiceSupabase } from '@/lib/supabase';

export type HearingUserInterest = {
  following: boolean;
  draftOpened: boolean;
};

export async function loadHearingUserInterest(
  userId: string,
  stortingetHearingId: string,
): Promise<HearingUserInterest> {
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('hearing_user_interest')
    .select('followed_at,draft_opened_at')
    .eq('user_id', userId)
    .eq('stortinget_hearing_id', stortingetHearingId)
    .maybeSingle();

  if (error || !data) {
    return { following: false, draftOpened: false };
  }

  return {
    following: data.followed_at != null,
    draftOpened: data.draft_opened_at != null,
  };
}

export async function recordHearingUserInterest(args: {
  userId: string;
  stortingetHearingId: string;
  follow?: boolean;
  draftOpened?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const service = getServiceSupabase();
  const { error } = await service.rpc('record_hearing_user_interest', {
    p_user_id: args.userId,
    p_stortinget_hearing_id: args.stortingetHearingId,
    p_follow: args.follow ?? null,
    p_draft_opened: args.draftOpened ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}