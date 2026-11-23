import { requireAdminPage } from '@/lib/admin/gate';
import { routes } from '@/lib/routes';
import AdminStatistikkClient from './admin-statistikk-client';

export const dynamic = 'force-dynamic';

export default async function AdminStatistikkPage() {
  await requireAdminPage(routes.adminStats);
  const umamiAdminUrl = process.env.UMAMI_ADMIN_URL?.trim() || null;
  return <AdminStatistikkClient umamiAdminUrl={umamiAdminUrl} />;
}
