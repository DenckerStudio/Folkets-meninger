import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Scripts run outside generated Database types; RPCs come from manual migrations. */
export type BackfillSupabase = SupabaseClient<any, 'public', any>;

export function createBackfillSupabase(url: string, serviceKey: string): BackfillSupabase {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
