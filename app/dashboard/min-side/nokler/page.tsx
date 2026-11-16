import { MinSideNoklerPage } from '@/components/min-side/min-side-section-pages';
import { isAdmin } from '@/lib/admin/gate';
import { getServerSupabase } from '@/lib/supabase-server';

export default async function MinSideNoklerRoutePage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerIsAdmin = user ? await isAdmin(user.id, user.email) : false;

  return <MinSideNoklerPage isAdmin={viewerIsAdmin} />;
}