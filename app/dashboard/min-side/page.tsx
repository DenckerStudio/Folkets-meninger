import { MinSideOverviewPanel } from '@/components/min-side/min-side-overview-panel';
import { isAdmin } from '@/lib/admin/gate';
import { loadMinSideOverview } from '@/lib/min-side/overview';
import { getServerSupabase } from '@/lib/supabase-server';

export default async function MinSideOverviewPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const viewerIsAdmin = user ? await isAdmin(user.id, user.email) : false;
  const overview = user ? await loadMinSideOverview(user.id) : { ok: false as const };

  return (
    <MinSideOverviewPanel
      snapshot={overview.ok ? overview.data : null}
      showAdminLink={viewerIsAdmin}
    />
  );
}