import { getServiceSupabase } from '@/lib/supabase';

export type AppAdminRecord = {
  userId: string;
  email: string | null;
  role: string;
  grantedAt: string;
  grantedBy: string | null;
};

export async function listAppAdmins(): Promise<AppAdminRecord[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('list_app_admins');
  if (error || !Array.isArray(data)) return [];
  return data
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      if (typeof r.user_id !== 'string') return null;
      return {
        userId: r.user_id,
        email: typeof r.email === 'string' ? r.email : null,
        role: typeof r.role === 'string' ? r.role : 'admin',
        grantedAt: typeof r.granted_at === 'string' ? r.granted_at : '',
        grantedBy: typeof r.granted_by === 'string' ? r.granted_by : null,
      } satisfies AppAdminRecord;
    })
    .filter((x): x is AppAdminRecord => x != null);
}

export async function grantAppRoleByEmail(email: string, grantedBy: string): Promise<string> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('grant_app_role_by_email', {
    p_email: email,
    p_role: 'admin',
    p_granted_by: grantedBy,
  });
  if (error) throw error;
  return String(data);
}

export async function revokeAppRoleByEmail(email: string): Promise<string> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('revoke_app_role_by_email', {
    p_email: email,
    p_role: 'admin',
  });
  if (error) throw error;
  return String(data);
}
