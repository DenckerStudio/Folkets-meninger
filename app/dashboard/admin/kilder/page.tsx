import AdminKilderClient from './admin-kilder-client';
import { requireAdminPage } from '@/lib/admin/gate';
import { loadAdminKildeOverview, kildeOverviewNotReady } from '@/lib/admin/kilder/overview';
import { routes } from '@/lib/routes';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function AdminKilderPage() {
  await requireAdminPage(routes.adminKilder);

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let overview = kildeOverviewNotReady;
  if (user?.id) {
    try {
      overview = await loadAdminKildeOverview(user.id);
    } catch {
      overview = kildeOverviewNotReady;
    }
  }

  return <AdminKilderClient initialData={overview} />;
}