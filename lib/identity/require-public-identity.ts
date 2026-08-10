import { getServiceSupabase } from '@/lib/supabase';
import { userHasPublicIdentity } from '@/lib/identity/public-identity';

export async function userHasPublicIdentityInDb(userId: string): Promise<boolean> {
  const service = getServiceSupabase();
  const { data } = await service
    .from('users')
    .select('first_name, last_name')
    .eq('id', userId)
    .maybeSingle();

  return userHasPublicIdentity(data);
}

export {
  PUBLIC_IDENTITY_ERROR,
  FORUM_IDENTITY_ERROR,
} from '@/lib/identity/public-identity';
