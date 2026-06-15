import { getServiceSupabase } from '@/lib/supabase';

export type UserPointSummary = {
  points: number;
  recent: Array<{
    id: string;
    delta: number;
    reason: string;
    refType: string;
    createdAt: string;
  }>;
};

export async function getUserPointSummary(userId: string, limit = 10): Promise<UserPointSummary> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { points: 0, recent: [] };
  }

  const service = getServiceSupabase();
  const [{ data: balance }, { data: ledger }] = await Promise.all([
    service
      .from('user_points_balances')
      .select('points')
      .eq('user_id', userId)
      .maybeSingle(),
    service
      .from('user_points_ledger')
      .select('id, delta, reason, ref_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  return {
    points: balance?.points ?? 0,
    recent: (ledger ?? []).map((row) => ({
      id: row.id,
      delta: row.delta,
      reason: row.reason,
      refType: row.ref_type,
      createdAt: row.created_at,
    })),
  };
}
