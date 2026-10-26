import { getServiceSupabase } from '@/lib/supabase';
import type { ChatRagClient } from '@/lib/chat/rag';

/**
 * Hybrid search SECURITY DEFINER RPCs are service_role-only in Postgres.
 * Call only from server routes that already passed requireStemmePlus (or equivalent).
 */
export function getChatRagRpcClient(): ChatRagClient {
  return getServiceSupabase();
}
