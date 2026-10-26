import { getServiceSupabase } from '@/lib/supabase';
import { isPostgrestMissingRpcError } from '@/lib/polls/rpc-missing';

type RpcProbeClient = Pick<ReturnType<typeof getServiceSupabase>, 'rpc'>;

/**
 * Whether `admin_submit_content_feedback` is registered in PostgREST (migration
 * 20261021140000). Uses invalid args so upsert rejects before writing.
 */
export async function isRegenerationOnRejectAvailable(
  supabase?: RpcProbeClient,
): Promise<boolean> {
  const client = supabase ?? getServiceSupabase();
  const { error } = await client.rpc('admin_submit_content_feedback', {
    p_content_type: '__capability_probe__',
    p_content_id: '',
    p_verdict: 'approve',
    p_aspects: {},
    p_reason_tags: [],
    p_note: null,
    p_admin_id: '00000000-0000-4000-8000-000000000000',
    p_snapshot: {},
  });
  if (!error) {
    return true;
  }
  if (isPostgrestMissingRpcError(error)) {
    return false;
  }
  return true;
}
