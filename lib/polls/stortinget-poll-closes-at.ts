import { getServiceSupabase } from '@/lib/supabase';

export async function setPollClosesAt(pollId: string, closesAtIso: string): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('missing service role');
  }
  const service = getServiceSupabase();
  const { error } = await service.from('polls').update({ closes_at: closesAtIso }).eq('id', pollId);
  if (error) throw error;
}
