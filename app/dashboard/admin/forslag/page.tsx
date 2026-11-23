import { requireAdminPage } from '@/lib/admin/gate';
import { routes } from '@/lib/routes';
import AdminForslagClient from './admin-forslag-client';

export const dynamic = 'force-dynamic';

export default async function AdminForslagPage() {
  await requireAdminPage(routes.adminForslag);
  return <AdminForslagClient />;
}
