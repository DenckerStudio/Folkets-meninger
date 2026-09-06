import { getServiceSupabase } from '@/lib/supabase';

export type StemmePlusSupporter = {
  userId: string;
  email: string | null;
  subscriptionStatus: string | null;
  subscriptionPeriodEnd: string | null;
};

export async function listStemmePlusSupporters(): Promise<StemmePlusSupporter[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('list_stemme_plus_supporters');
  if (error || !Array.isArray(data)) return [];

  return data
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      if (typeof r.user_id !== 'string') return null;
      return {
        userId: r.user_id,
        email: typeof r.email === 'string' ? r.email : null,
        subscriptionStatus: typeof r.subscription_status === 'string' ? r.subscription_status : null,
        subscriptionPeriodEnd:
          typeof r.subscription_period_end === 'string' ? r.subscription_period_end : null,
      } satisfies StemmePlusSupporter;
    })
    .filter((x): x is StemmePlusSupporter => x != null);
}

export async function grantStemmePlusByEmail(email: string, grantedBy: string): Promise<string> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('grant_stemme_plus_by_email', {
    p_email: email,
    p_granted_by: grantedBy,
  });
  if (error) throw error;
  return String(data);
}

export async function revokeStemmePlusByEmail(email: string): Promise<string> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('revoke_stemme_plus_by_email', {
    p_email: email,
  });
  if (error) throw error;
  return String(data);
}
