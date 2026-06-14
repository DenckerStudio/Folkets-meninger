import { getServiceSupabase } from '@/lib/supabase';
import { userHasForumIdentity } from '@/lib/forum/author-display';

export async function userHasForumIdentityInDb(userId: string): Promise<boolean> {
  const service = getServiceSupabase();
  const { data } = await service
    .from('users')
    .select('first_name, last_name')
    .eq('id', userId)
    .maybeSingle();

  return userHasForumIdentity(data);
}

export const FORUM_IDENTITY_ERROR =
  'Du må fylle ut fornavn og etternavn under Min side før du kan skrive i forumet.';
